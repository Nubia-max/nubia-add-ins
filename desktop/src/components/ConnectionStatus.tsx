import React from 'react';

interface ConnectionStatusProps {
  isConnected: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ isConnected }) => {
  return (
    <div className="relative">
      <div 
        className={`
          w-3 h-3 rounded-full shadow-sm transition-all duration-300
          ${isConnected 
            ? 'bg-success-500 animate-pulse-soft' 
            : 'bg-error-500 animate-bounce-soft'
          }
        `}
        title={isConnected ? 'Connected' : 'Disconnected'}
      />
      
      {/* Pulse ring effect for connected state */}
      {isConnected && (
        <div className="absolute inset-0 rounded-full bg-success-500 opacity-30 animate-ping" />
      )}
      
      {/* Status tooltip */}
      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-surface-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
        {isConnected ? 'Connected' : 'Disconnected'}
      </div>
    </div>
  );
};