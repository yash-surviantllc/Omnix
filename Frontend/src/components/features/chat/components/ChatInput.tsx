import { Mic, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onVoiceInput: () => void;
  isListening: boolean;
  placeholder: string;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onVoiceInput,
  isListening,
  placeholder
}: ChatInputProps) {
  return (
    <div className="p-4 border-t">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && onSend()}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button
          variant={isListening ? 'default' : 'outline'}
          size="sm"
          onClick={onVoiceInput}
          disabled={isListening}
        >
          <Mic className={`h-4 w-4 ${isListening ? 'animate-pulse' : ''}`} />
        </Button>
        <Button size="sm" onClick={onSend}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
