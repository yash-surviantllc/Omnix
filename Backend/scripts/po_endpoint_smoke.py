import requests

BASE_URL = 'http://localhost:8000/api/v1'
LOGIN_URL = f'{BASE_URL}/auth/login'
ORDERS_URL = f'{BASE_URL}/purchase-orders'

login_data = {'email_or_username': 'testadmin', 'password': 'TestAdmin123!'}
headers = {'Content-Type': 'application/json'}

def main():
    print('Logging in...')
    login_resp = requests.post(LOGIN_URL, json=login_data, headers=headers, timeout=10)
    print('Login status:', login_resp.status_code)
    login_resp.raise_for_status()
    access_token = login_resp.json()['access_token']

    auth_headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }

    print('\nListing purchase orders (page=1, limit=1)...')
    list_resp = requests.get(f'{ORDERS_URL}?page=1&limit=1', headers=auth_headers, timeout=20)
    print('List status:', list_resp.status_code)
    print('Response body:', list_resp.text[:500])
    list_resp.raise_for_status()
    orders = list_resp.json()

    if orders:
        order_id = orders[0]['id']
        print(f"\nFetching order {order_id} detail...")
        detail_resp = requests.get(f'{ORDERS_URL}/{order_id}', headers=auth_headers, timeout=20)
        print('Detail status:', detail_resp.status_code)
        print('Detail body sample:', detail_resp.text[:500])
        detail_resp.raise_for_status()

        print('\nFetching materials...')
        mat_resp = requests.get(f'{ORDERS_URL}/{order_id}/materials', headers=auth_headers, timeout=20)
        print('Materials status:', mat_resp.status_code)
        print('Materials body sample:', mat_resp.text[:500])
        mat_resp.raise_for_status()

        print('\nFetching progress...')
        prog_resp = requests.get(f'{ORDERS_URL}/{order_id}/progress', headers=auth_headers, timeout=20)
        print('Progress status:', prog_resp.status_code)
        print('Progress body sample:', prog_resp.text[:500])
        prog_resp.raise_for_status()
    else:
        print('No orders returned to test detail endpoints.')

if __name__ == '__main__':
    main()
