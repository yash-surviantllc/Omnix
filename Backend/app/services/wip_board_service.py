from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, date
from decimal import Decimal, InvalidOperation
from typing import Dict, List, Optional

from app.services.websocket_manager import manager as ws_manager
from app.database import get_db
from app.schemas.wip import (
    AlertEventPayload,
    BottleneckResponse,
    StageMetricPoint,
    StageMetricsDetailResponse,
    StageOrderItem,
    StageOrdersResponse,
    StageUpdatePayload,
    TransferEventPayload,
    TrendPoint,
    TrendResponse,
    WIPAlertResponse,
    WIPAlertSeverity,
    WIPAlertType,
    WIPBoardResponse,
    WIPEventType,
    WIPHealthStatus,
    WIPStageCreate,
    WIPStageMetrics,
    WIPStageResponse,
    WIPStageUpdate,
    WIPTransferCreate,
    WIPTransferResponse,
)


class WIPBoardService:
    """Service layer for the WIP Board (stages, transfers, metrics, alerts)."""

    # ---------- Stage CRUD ----------

    async def list_stages(self, include_inactive: bool = False) -> List[WIPStageResponse]:
        db = get_db()
        query = db.table("wip_stages").select("*").order("sequence_number")
        if not include_inactive:
            query = query.eq("is_active", True)
        result = query.execute()
        return [WIPStageResponse(**row) for row in result.data or []]

    async def get_stage(self, stage_id: str) -> WIPStageResponse:
        db = get_db()
        result = (
            db.table("wip_stages")
            .select("*")
            .eq("id", stage_id)
            .single()
            .execute()
        )
        if not result.data:
            raise ValueError("Stage not found")
        return WIPStageResponse(**result.data)

    async def create_stage(self, stage_data: WIPStageCreate) -> WIPStageResponse:
        db = get_db()
        payload = stage_data.model_dump()
        payload["created_at"] = datetime.utcnow().isoformat()
        payload["updated_at"] = payload["created_at"]
        result = db.table("wip_stages").insert(payload).execute()
        if not result.data:
            raise ValueError("Failed to create stage")
        return WIPStageResponse(**result.data[0])

    async def update_stage(self, stage_id: str, updates: WIPStageUpdate) -> WIPStageResponse:
        db = get_db()
        update_data = {
            k: v for k, v in updates.model_dump(exclude_unset=True).items()
        }
        if not update_data:
            return await self.get_stage(stage_id)
        update_data["updated_at"] = datetime.utcnow().isoformat()
        result = (
            db.table("wip_stages")
            .update(update_data)
            .eq("id", stage_id)
            .execute()
        )
        if not result.data:
            raise ValueError("Stage not found")
        await self._broadcast_stage(stage_id)
        return WIPStageResponse(**result.data[0])

    async def delete_stage(self, stage_id: str) -> dict:
        db = get_db()
        # Get current stage to find its sequence number
        current = db.table("wip_stages").select("sequence_number").eq("id", stage_id).execute()
        if not current.data:
            raise ValueError("Stage not found")
        
        old_sequence = current.data[0].get("sequence_number")
        
        # Soft delete by marking inactive and setting sequence to NULL to free up the number
        # Use a large negative number based on timestamp to avoid conflicts
        import time
        archived_sequence = -int(time.time() * 1000) % 1000000000  # Negative unique value
        
        result = (
            db.table("wip_stages")
            .update({
                "is_active": False, 
                "sequence_number": archived_sequence,
                "updated_at": datetime.utcnow().isoformat()
            })
            .eq("id", stage_id)
            .execute()
        )
        if not result.data:
            raise ValueError("Stage not found")
        
        # Reorder remaining active stages to fill the gap
        if old_sequence:
            remaining = (
                db.table("wip_stages")
                .select("id, sequence_number")
                .eq("is_active", True)
                .gt("sequence_number", old_sequence)
                .order("sequence_number")
                .execute()
            )
            for stage in remaining.data or []:
                db.table("wip_stages").update({
                    "sequence_number": stage["sequence_number"] - 1,
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("id", stage["id"]).execute()
        
        await self._broadcast_stage(stage_id)
        return {"message": "Stage archived"}

    # ---------- Board & Metrics ----------

    async def get_board(self) -> WIPBoardResponse:
        db = get_db()
        stages = self._fetch_active_stages(db)
        tracking = self._fetch_order_tracking(db)
        transfers = self._fetch_recent_transfers(db, days=30)

        metrics_list: List[WIPStageMetrics] = []
        total_orders = 0
        total_units = Decimal("0")

        for stage in stages:
            stage_id = stage["id"]
            metrics = self._build_metrics_for_stage(
                stage,
                tracking.get(stage_id, []),
                transfers.get(stage_id, []),
            )
            metrics_list.append(metrics)
            total_orders += metrics.orders_count
            total_units += metrics.units_count

        avg_cycle_time = (
            sum((m.avg_time_minutes for m in metrics_list), Decimal("0"))
            / Decimal(len(metrics_list))
            if metrics_list
            else Decimal("0")
        )

        bottleneck_stage = None
        bottleneck_candidates = [
            m for m in metrics_list if m.health_status != WIPHealthStatus.GREEN
        ]
        if bottleneck_candidates:
            bottleneck_stage = max(
                bottleneck_candidates,
                key=lambda m: m.utilization_percentage,
            ).stage_name

        return WIPBoardResponse(
            stages=metrics_list,
            total_orders=total_orders,
            total_units=float(total_units),  # Convert Decimal to float
            avg_cycle_time=float(avg_cycle_time),  # Convert Decimal to float
            bottleneck_stage=bottleneck_stage,
            last_updated=datetime.utcnow(),
        )

    async def get_stage_orders(self, stage_id: str) -> StageOrdersResponse:
        db = get_db()
        stage = await self.get_stage(stage_id)
        orders = self._fetch_order_tracking(db).get(stage_id, [])
        order_items = [
            StageOrderItem(
                order_id=row["order_id"],
                order_number=row.get("purchase_orders", {}).get("order_number", ""),
                product_name=row.get("purchase_orders", {})
                .get("products", {})
                .get("name"),
                quantity_in_stage=self._to_decimal(row.get("quantity_in_stage")),
                priority=row.get("purchase_orders", {}).get("priority"),
                status=row.get("purchase_orders", {}).get("status"),
                entered_stage_at=self._parse_datetime(row.get("entered_stage_at")),
            )
            for row in orders
        ]
        return StageOrdersResponse(stage_id=stage.id, stage_name=stage.name, orders=order_items)

    async def get_stage_metrics_detail(
        self, stage_id: str, history_days: int = 14
    ) -> StageMetricsDetailResponse:
        db = get_db()
        stage = await self.get_stage(stage_id)
        tracking = self._fetch_order_tracking(db).get(stage_id, [])
        transfers = self._fetch_recent_transfers(db, days=history_days).get(stage_id, [])

        latest_metrics = self._build_metrics_for_stage(stage.model_dump(), tracking, transfers)
        history = self._build_trend_points(transfers, history_days)

        return StageMetricsDetailResponse(
            stage=stage,
            latest_metrics=latest_metrics,
            history=history,
        )

    async def list_bottlenecks(self) -> List[BottleneckResponse]:
        board = await self.get_board()
        responses: List[BottleneckResponse] = []
        for metrics in board.stages:
            if metrics.health_status == WIPHealthStatus.GREEN:
                continue
            severity = (
                WIPAlertSeverity.CRITICAL
                if metrics.health_status == WIPHealthStatus.RED
                else WIPAlertSeverity.WARNING
            )
            responses.append(
                BottleneckResponse(
                    stage_id=metrics.stage_id,
                    stage_name=metrics.stage_name,
                    avg_time_minutes=metrics.avg_time_minutes,
                    target_avg_time_minutes=metrics.target_avg_time_minutes,
                    utilization_percentage=metrics.utilization_percentage,
                    orders_count=metrics.orders_count,
                    units_count=metrics.units_count,
                    severity=severity,
                )
            )
        return responses

    async def list_trends(
        self, stage_id: Optional[str] = None, days: int = 14
    ) -> List[TrendResponse]:
        db = get_db()
        stages = (
            [await self.get_stage(stage_id)]
            if stage_id
            else await self.list_stages(include_inactive=False)
        )
        transfers = self._fetch_recent_transfers(db, days=days)
        responses: List[TrendResponse] = []
        for stage in stages:
            stage_transfers = transfers.get(stage.id, [])
            points = self._build_trend_points(stage_transfers, days)
            responses.append(
                TrendResponse(stage_id=stage.id, stage_name=stage.name, points=points)
            )
        return responses

    async def list_alerts(self) -> List[WIPAlertResponse]:
        board = await self.get_board()
        alerts: List[WIPAlertResponse] = []
        for metrics in board.stages:
            alert = self._derive_alert_from_metrics(metrics)
            if alert:
                alerts.append(alert)
        return alerts

    # ---------- Transfers ----------

    async def record_transfer(
        self, payload: WIPTransferCreate, user_id: str
    ) -> WIPTransferResponse:
        db = get_db()
        # For now, we hardcode 'DISPATCH' as the completion stage or any stage updates progress.
        
        # 1. Fetch destination stage details to check code
        to_stage = db.table('wip_stages').select('code').eq('id', transfer.to_stage_id).single().execute()
        
        if to_stage.data:
            stage_code = to_stage.data.get('code')
            
            # 2. Update PO 'quantity_completed' ONLY if moving to DISPATCH (Final Completion)
            # Or do we update it incrementally? 
            # Traditional WIP: Quantity Completed usually means "Finished Goods Produced". 
            # So only when it hits the final stage.
            
            if stage_code == 'DISPATCH':
                # Increment quantity_completed on PO
                # We need to be careful about concurrency, but for now strict increment.
                # Ideally: update purchase_orders set quantity_completed = quantity_completed + X
                
                # Fetch current PO
                po_res = db.table('purchase_orders').select('id', 'quantity', 'quantity_completed').eq('id', payload.order_id).single().execute()
                if po_res.data:
                    po = po_res.data
                    current_completed = Decimal(str(po.get('quantity_completed') or 0))
                    transfer_qty = Decimal(str(payload.quantity))
                    
                    new_completed = current_completed + transfer_qty
                    
                    po_update = {'quantity_completed': float(new_completed)}
                    
                    # Check for Order Completion
                    # If we have completed >= ordered quantity
                    target_qty = Decimal(str(po['quantity']))
                    if new_completed >= target_qty:
                         # Update Status to Completed
                         # logic is handled in PurchaseOrderService.update_order_status
                         # So we call that service.
                         from app.services.purchase_order_service import PurchaseOrderService
                         from app.schemas.purchase_order import OrderStatusUpdate
                         
                         await PurchaseOrderService.update_order_status(
                             po['id'], 
                             OrderStatusUpdate(status='Completed', notes='Auto-completed via WIP Transfer'), 
                             user_id
                         )
                    else:
                        # Just update quantity
                        db.table('purchase_orders').update(po_update).eq('id', po['id']).execute()

        return transfer

    # ---------- Internal helpers ----------

    def _fetch_active_stages(self, db) -> List[Dict]:
        result = (
            db.table("wip_stages")
            .select("*")
            .eq("is_active", True)
            .order("sequence_number")
            .execute()
        )
        return result.data or []

    def _fetch_order_tracking(self, db) -> Dict[str, List[Dict]]:
        result = (
            db.table("order_stage_tracking")
            .select(
                "id, order_id, current_stage_id, quantity_in_stage, entered_stage_at,"
                "purchase_orders(order_number, priority, status, products(name))"
            )
            .execute()
        )
        grouped: Dict[str, List[Dict]] = defaultdict(list)
        for row in result.data or []:
            grouped[row["current_stage_id"]].append(row)
        return grouped

    def _fetch_recent_transfers(self, db, days: int) -> Dict[str, List[Dict]]:
        cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
        result = (
            db.table("wip_transfers")
            .select("*")
            .gte("created_at", cutoff)
            .execute()
        )
        grouped: Dict[str, List[Dict]] = defaultdict(list)
        for row in result.data or []:
            grouped[row["to_stage_id"]].append(row)
        return grouped

    def _build_metrics_for_stage(
        self,
        stage_row: Dict,
        tracking_rows: List[Dict],
        transfer_rows: List[Dict],
    ) -> WIPStageMetrics:
        orders_count = len(tracking_rows)
        units_count = sum(
            (self._to_decimal(row.get("quantity_in_stage")) for row in tracking_rows),
            Decimal("0"),
        )
        avg_time = self._average_transfer_time(transfer_rows)
        target = self._to_decimal(stage_row.get("target_avg_time_minutes"), default="0")

        if avg_time == Decimal("0"):
            avg_time = target or Decimal("0")

        utilization = self._calculate_utilization(avg_time, target)
        health = self._determine_health(avg_time, target, utilization)

        return WIPStageMetrics(
            stage_id=stage_row["id"],
            stage_name=stage_row["name"],
            sequence_number=stage_row["sequence_number"],
            orders_count=orders_count,
            units_count=float(units_count),  # Convert Decimal to float
            avg_time_minutes=float(avg_time),  # Convert Decimal to float
            target_avg_time_minutes=float(target),  # Convert Decimal to float
            utilization_percentage=float(utilization),  # Convert Decimal to float
            health_status=health,
        )

    def _average_transfer_time(self, transfer_rows: List[Dict]) -> Decimal:
        if not transfer_rows:
            return Decimal("0")
        durations = [
            self._to_decimal(row.get("actual_time_minutes"))
            or self._calculate_actual_time_minutes(
                self._parse_datetime(row.get("start_time")),
                self._parse_datetime(row.get("end_time")),
            )
            for row in transfer_rows
        ]
        total = sum((duration for duration in durations if duration), Decimal("0"))
        count = len([d for d in durations if d is not None])
        return total / Decimal(count) if count else Decimal("0")

    def _calculate_utilization(self, avg_time: Decimal, target: Decimal) -> Decimal:
        if target is None or target == Decimal("0"):
            return Decimal("0")
        if avg_time == Decimal("0"):
            return Decimal("0")
        ratio = (target / avg_time) * Decimal("100")
        return ratio

    def _determine_health(
        self, avg_time: Decimal, target: Decimal, utilization: Decimal
    ) -> WIPHealthStatus:
        if target == Decimal("0") and avg_time == Decimal("0"):
             return WIPHealthStatus.GREEN # Default/Empty
             
        if utilization < Decimal("80"):
            return WIPHealthStatus.RED # Delayed / Underutilized
        elif utilization <= Decimal("110"):
             return WIPHealthStatus.GREEN # Healthy / Ideal
        else:
            return WIPHealthStatus.YELLOW # Warning / Overutilized

    def _build_trend_points(
        self, transfer_rows: List[Dict], days: int
    ) -> List[TrendPoint]:
        grouped: Dict[date, List[Dict]] = defaultdict(list)
        for row in transfer_rows:
            created_at = self._parse_datetime(row.get("created_at")).date()
            grouped[created_at].append(row)

        points: List[TrendPoint] = []
        for i in range(days):
            day = (datetime.utcnow().date() - timedelta(days=days - i - 1))
            rows = grouped.get(day, [])
            orders_processed = len({row["order_id"] for row in rows})
            units_processed = sum(
                (self._to_decimal(row.get("quantity")) for row in rows), Decimal("0")
            )
            avg_time = self._average_transfer_time(rows)
            utilization = self._calculate_utilization(
                avg_time, self._default_target_from_rows(rows)
            )
            health = self._determine_health(
                avg_time, self._default_target_from_rows(rows), utilization
            )
            points.append(
                TrendPoint(
                    date=day,
                    orders_processed=orders_processed,
                    units_processed=units_processed,
                    avg_time_minutes=avg_time,
                    utilization_percentage=utilization,
                    health_status=health,
                )
            )
        return points

    def _default_target_from_rows(self, rows: List[Dict]) -> Decimal:
        if not rows:
            return Decimal("0")
        stage_targets = [
            self._to_decimal(row.get("target_avg_time_minutes")) for row in rows
        ]
        return stage_targets[0] if stage_targets and stage_targets[0] else Decimal("30")

    def _derive_alert_from_metrics(
        self, metrics: WIPStageMetrics
    ) -> Optional[WIPAlertResponse]:
        if metrics.health_status == WIPHealthStatus.GREEN:
            return None
        if (
            metrics.avg_time_minutes > metrics.target_avg_time_minutes * Decimal("1.2")
            or metrics.utilization_percentage < Decimal("60")
        ):
            severity = (
                WIPAlertSeverity.CRITICAL
                if metrics.health_status == WIPHealthStatus.RED
                else WIPAlertSeverity.WARNING
            )
            alert_type = (
                WIPAlertType.BOTTLENECK
                if metrics.avg_time_minutes
                > metrics.target_avg_time_minutes * Decimal("1.2")
                else WIPAlertType.UNDER_UTILIZATION
            )
            return WIPAlertResponse(
                stage_id=metrics.stage_id,
                stage_name=metrics.stage_name,
                alert_type=alert_type,
                severity=severity,
                message=f"{metrics.stage_name} is trending {alert_type.value.replace('_', ' ')}",
                detected_at=datetime.utcnow(),
            )
        return None

    def _generate_transfer_number(self, db, year: int) -> str:
        try:
            seq_result = db.rpc("get_wip_transfer_nextval", {}).execute()
            seq_value = seq_result.data
        except Exception:
            # Fallback if RPC missing (Test/Dev)
            from random import randint
            seq_value = randint(1000, 999999)
            
        return f"WT-{year}-{str(seq_value).zfill(5)}"

    def _calculate_actual_time_minutes(
        self, start_time: Optional[datetime], end_time: Optional[datetime]
    ) -> Optional[Decimal]:
        if not start_time or not end_time:
            return None
        delta = end_time - start_time
        minutes = Decimal(delta.total_seconds()) / Decimal("60")
        return max(Decimal("0"), minutes)

    def _apply_stage_tracking_update(self, db, transfer_data: Dict) -> None:
        order_id = transfer_data["order_id"]
        qty = self._to_decimal(transfer_data["quantity"])
        now = datetime.utcnow().isoformat()

        from_stage = transfer_data.get("from_stage_id")
        if from_stage:
            existing = (
                db.table("order_stage_tracking")
                .select("*")
                .eq("order_id", order_id)
                .eq("current_stage_id", from_stage)
                .execute()
            )
            if existing.data:
                row_data = existing.data[0]
                current_qty = self._to_decimal(row_data.get("quantity_in_stage"))
                if qty > current_qty:
                    raise ValueError(f"Insufficient quantity in source stage. Available: {current_qty}, Requested: {qty}")
                
                new_qty = current_qty - qty
                update_payload = {
                    "quantity_in_stage": float(new_qty),
                    # "updated_at": now,
                }
                db.table("order_stage_tracking").update(update_payload).eq("id", row_data["id"]).execute()

        # upsert destination stage tracking
        existing_to = (
            db.table("order_stage_tracking")
            .select("*")
            .eq("order_id", order_id)
            .eq("current_stage_id", transfer_data["to_stage_id"])
            .execute()
        )
        if existing_to.data:
            to_row = existing_to.data[0]
            new_qty = self._to_decimal(to_row.get("quantity_in_stage")) + qty
            db.table("order_stage_tracking").update(
                {
                    "quantity_in_stage": float(new_qty),
                    # "updated_at": now,
                }
            ).eq("id", to_row["id"]).execute()
        else:
            db.table("order_stage_tracking").insert(
                {
                    "order_id": order_id,
                    "current_stage_id": transfer_data["to_stage_id"],
                    "quantity_in_stage": float(qty),
                    "entered_stage_at": now,
                    # "created_at": now,
                    # "updated_at": now,
                }
            ).execute()

    async def _broadcast_stage(self, stage_id: str) -> None:
        db = get_db()
        tracking = self._fetch_order_tracking(db)
        transfers = self._fetch_recent_transfers(db, days=14)
        stage = (
            db.table("wip_stages")
            .select("*")
            .eq("id", stage_id)
            .single()
            .execute()
            .data
        )
        if not stage:
            return
        metrics = self._build_metrics_for_stage(
            stage,
            tracking.get(stage_id, []),
            transfers.get(stage_id, []),
        )
        event = StageUpdatePayload(
            event_type=WIPEventType.STAGE_UPDATE,
            timestamp=datetime.utcnow(),
            data=metrics,
        )
        await ws_manager.broadcast(event.model_dump(mode='json'))

    async def _broadcast_transfer(self, transfer: WIPTransferResponse) -> None:
        event = TransferEventPayload(
            event_type=WIPEventType.TRANSFER_RECORDED,
            timestamp=datetime.utcnow(),
            data=transfer,
        )
        await ws_manager.broadcast(event.model_dump(mode='json'))

    def _to_decimal(self, value, default: str = "0") -> Decimal:
        if value is None:
            return Decimal(default)
        if isinstance(value, Decimal):
            return value
        try:
            return Decimal(str(value))
        except (InvalidOperation, ValueError, TypeError):
            return Decimal(default)

    def _parse_datetime(self, value) -> datetime:
        if isinstance(value, datetime):
            return value
        if not value:
            return datetime.utcnow()
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return datetime.utcnow()


wip_board_service = WIPBoardService()
