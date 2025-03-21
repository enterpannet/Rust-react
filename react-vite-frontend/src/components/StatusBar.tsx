import React, { useState, useEffect } from 'react';
import { Badge, Space } from 'antd';
import { CheckCircleOutlined, DisconnectOutlined } from '@ant-design/icons';
import { MousePosition } from '../types';

interface StatusBarProps {
  isConnected: boolean;
  mousePosition: MousePosition;
  message?: string;
  messageType?: 'info' | 'success' | 'error' | 'warning';
}

const StatusBar: React.FC<StatusBarProps> = ({ 
  isConnected, 
  mousePosition,
  message,
  messageType = 'info'
}) => {
  const [showMessage, setShowMessage] = useState<boolean>(false);
  
  useEffect(() => {
    if (message) {
      setShowMessage(true);
      const timer = setTimeout(() => {
        setShowMessage(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [message]);
  
  const getMessageColor = () => {
    switch (messageType) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      default: return 'text-blue-600';
    }
  };
  
  return (
    <div className="flex items-center justify-between px-4 h-full">
      <div>
        <Space>
          {isConnected ? (
            <Badge status="success" text="Connected" />
          ) : (
            <Badge status="error" text="Disconnected" />
          )}
        </Space>
      </div>
      
      <div className={`text-center font-medium ${getMessageColor()} ${showMessage ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}>
        {message}
      </div>
      
      <div>
        <span>ตำแหน่งเมาส์: X: {mousePosition.x}, Y: {mousePosition.y}</span>
      </div>
    </div>
  );
};

export default StatusBar; 