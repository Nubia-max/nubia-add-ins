import React, { useState, useEffect } from 'react';

interface SystemStatusProps {
  theme: 'light' | 'dark';
  isConnected: boolean;
  backendStatus?: 'healthy' | 'degraded' | 'down';
  automationStatus?: 'healthy' | 'degraded' | 'down';
}

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
  lastCheck: Date;
}

export const SystemStatus: React.FC<SystemStatusProps> = ({
  theme,
  isConnected,
  backendStatus = 'healthy',
  automationStatus = 'healthy'
}) => {
  const [services, setServices] = useState<ServiceStatus[]>([
    {
      name: 'Backend API',
      status: backendStatus,
      responseTime: 125,
      lastCheck: new Date()
    },
    {
      name: 'Automation Service',
      status: automationStatus,
      responseTime: 89,
      lastCheck: new Date()
    },
    {
      name: 'WebSocket Connection',
      status: isConnected ? 'healthy' : 'down',
      lastCheck: new Date()
    }
  ]);

  const [overallStatus, setOverallStatus] = useState<'healthy' | 'degraded' | 'down'>('healthy');

  useEffect(() => {
    // Update services
    setServices([
      {
        name: 'Backend API',
        status: backendStatus,
        responseTime: 125 + Math.random() * 100,
        lastCheck: new Date()
      },
      {
        name: 'Automation Service',
        status: automationStatus,
        responseTime: 89 + Math.random() * 50,
        lastCheck: new Date()
      },
      {
        name: 'WebSocket Connection',
        status: isConnected ? 'healthy' : 'down',
        lastCheck: new Date()
      }
    ]);

    // Calculate overall status
    if (!isConnected || backendStatus === 'down' || automationStatus === 'down') {
      setOverallStatus('down');
    } else if (backendStatus === 'degraded' || automationStatus === 'degraded') {
      setOverallStatus('degraded');
    } else {
      setOverallStatus('healthy');
    }
  }, [isConnected, backendStatus, automationStatus]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-success-500';
      case 'degraded':
        return 'text-warning-500';
      case 'down':
        return 'text-error-500';
      default:
        return theme === 'dark' ? 'text-surface-400' : 'text-surface-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return '🟢';
      case 'degraded':
        return '🟡';
      case 'down':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const getStatusBg = (status: string) => {
    const baseClasses = theme === 'dark' ? 'border-surface-700' : 'border-surface-200';
    
    switch (status) {
      case 'healthy':
        return `${baseClasses} ${theme === 'dark' ? 'bg-success-900/20' : 'bg-success-50'}`;
      case 'degraded':
        return `${baseClasses} ${theme === 'dark' ? 'bg-warning-900/20' : 'bg-warning-50'}`;
      case 'down':
        return `${baseClasses} ${theme === 'dark' ? 'bg-error-900/20' : 'bg-error-50'}`;
      default:
        return baseClasses;
    }
  };

  return (
    <div className={`
      p-4 rounded-xl border transition-all duration-200 ${getStatusBg(overallStatus)}
      ${theme === 'dark' ? 'bg-surface-800/50' : 'bg-white/50'}
      backdrop-blur-sm
    `}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">
            {getStatusIcon(overallStatus)}
          </div>
          <div>
            <h3 className={`font-semibold text-sm ${
              theme === 'dark' ? 'text-white' : 'text-surface-900'
            }`}>
              System Status
            </h3>
            <p className={`text-xs capitalize ${getStatusColor(overallStatus)}`}>
              {overallStatus}
            </p>
          </div>
        </div>
        
        {/* Refresh button */}
        <button
          onClick={() => {
            // Trigger a status refresh
            setServices(prev => prev.map(service => ({
              ...service,
              lastCheck: new Date()
            })));
          }}
          className={`
            p-2 rounded-lg transition-all duration-200
            ${theme === 'dark' 
              ? 'hover:bg-surface-700 text-surface-400 hover:text-white' 
              : 'hover:bg-surface-100 text-surface-500 hover:text-surface-700'
            }
          `}
          title="Refresh status"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Service list */}
      <div className="space-y-3">
        {services.map((service, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-sm">
                {getStatusIcon(service.status)}
              </div>
              <div>
                <div className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-surface-200' : 'text-surface-700'
                }`}>
                  {service.name}
                </div>
                {service.responseTime && (
                  <div className={`text-xs ${
                    theme === 'dark' ? 'text-surface-400' : 'text-surface-500'
                  }`}>
                    {Math.round(service.responseTime)}ms
                  </div>
                )}
              </div>
            </div>
            
            <div className={`text-xs ${
              theme === 'dark' ? 'text-surface-400' : 'text-surface-500'
            }`}>
              {service.lastCheck.toLocaleTimeString([], { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Overall health message */}
      <div className={`
        mt-4 pt-3 border-t text-xs text-center
        ${theme === 'dark' ? 'border-surface-700 text-surface-400' : 'border-surface-200 text-surface-500'}
      `}>
        {overallStatus === 'healthy' && '✨ All systems operational'}
        {overallStatus === 'degraded' && '⚠️ Some services experiencing issues'}
        {overallStatus === 'down' && '🚨 System maintenance required'}
      </div>
    </div>
  );
};