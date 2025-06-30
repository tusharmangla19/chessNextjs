import React from 'react';
import { Button } from './ui/button';
import { Phone, PhoneOff } from 'lucide-react';

interface VideoCallButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  isInCall?: boolean;
}

export const VideoCallButton: React.FC<VideoCallButtonProps> = ({
  onClick,
  disabled = false,
  className = '',
  isInCall = false
}) => {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      variant={isInCall ? "danger" : "gradient"}
      className={className}
    >
      {isInCall ? (
        <>
          <PhoneOff className="mr-2 h-4 w-4" />
          End Call
        </>
      ) : (
        <>
          <Phone className="mr-2 h-4 w-4" />
          Video Call
        </>
      )}
    </Button>
  );
}; 