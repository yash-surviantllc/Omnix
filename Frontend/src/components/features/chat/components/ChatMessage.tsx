import { motion } from 'motion/react';

interface ChatMessageProps {
  id: string;
  type: 'user' | 'bot';
  content: string;
  children?: React.ReactNode;
}

export function ChatMessage({ type, content, children }: ChatMessageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${type === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[80%] ${type === 'user' ? 'bg-emerald-600 text-white' : 'bg-zinc-100'} rounded-lg p-3`}>
        {content}
        {children}
      </div>
    </motion.div>
  );
}
