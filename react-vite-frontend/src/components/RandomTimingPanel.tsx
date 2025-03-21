import React, { useState, useEffect } from 'react';
import { Card, Switch, Slider, InputNumber, Typography, Space, Button, Row, Col } from 'antd';
import { DashboardOutlined, SaveOutlined } from '@ant-design/icons';

const { Title } = Typography;

interface RandomTimingPanelProps {
  isConnected: boolean;
  randomTiming: {
    enabled: boolean;
    minFactor: number;
    maxFactor: number;
  };
  onUpdateRandomTiming: (enabled: boolean, minFactor: number, maxFactor: number) => void;
}

const RandomTimingPanel: React.FC<RandomTimingPanelProps> = ({
  isConnected,
  randomTiming,
  onUpdateRandomTiming
}) => {
  // Local state for form values
  const [enabled, setEnabled] = useState(randomTiming.enabled);
  const [minFactor, setMinFactor] = useState(randomTiming.minFactor);
  const [maxFactor, setMaxFactor] = useState(randomTiming.maxFactor);

  // Update local state when props change
  useEffect(() => {
    setEnabled(randomTiming.enabled);
    setMinFactor(randomTiming.minFactor);
    setMaxFactor(randomTiming.maxFactor);
  }, [randomTiming]);

  const handleSave = () => {
    onUpdateRandomTiming(enabled, minFactor, maxFactor);
  };

  return (
    <Card 
      title={
        <Space>
          <DashboardOutlined />
          <Title level={4} className="m-0">Random Timing</Title>
        </Space>
      } 
      className="w-full h-full"
    >
      <div className="mb-4 flex items-center justify-between">
        <p className="text-gray-600 m-0">Enable random timing variation:</p>
        <Switch 
          checked={enabled} 
          onChange={setEnabled}
          disabled={!isConnected}
        />
      </div>
      
      <div className={!enabled ? 'opacity-50' : ''}>
        <div className="mb-4">
          <p className="mb-1">Minimum Factor:</p>
          <div className="flex items-center gap-2">
            <Slider
              min={0.1}
              max={1.0}
              step={0.05}
              value={minFactor}
              onChange={(value) => setMinFactor(value)}
              disabled={!enabled || !isConnected}
              className="flex-1"
              tooltip={{ formatter: (value) => value.toFixed(2) }}
            />
            <InputNumber
              min={0.1}
              max={1}
              step={0.05}
              value={minFactor}
              onChange={(value) => setMinFactor(value)}
              disabled={!enabled || !isConnected}
              style={{ width: '80px' }}
            />
          </div>
        </div>
        
        <div className="mb-4">
          <p className="mb-1">Maximum Factor:</p>
          <div className="flex items-center gap-2">
            <Slider
              min={1.0}
              max={5.0}
              step={0.1}
              value={maxFactor}
              onChange={(value) => setMaxFactor(value)}
              disabled={!enabled || !isConnected}
              className="flex-1"
              tooltip={{ formatter: (value) => value.toFixed(2) }}
            />
            <InputNumber
              min={1}
              max={5}
              step={0.1}
              value={maxFactor}
              onChange={(value) => setMaxFactor(value)}
              disabled={!enabled || !isConnected}
              style={{ width: '80px' }}
            />
          </div>
        </div>
        
        <div className="mt-2">
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            disabled={!isConnected}
            className="w-full"
          >
            Save Random Timing Settings
          </Button>
        </div>
      </div>
      
      <div className="mt-4">
        <p className="text-xs text-gray-500">
          This setting randomizes wait times to make automations appear more human-like. 
          Wait times will vary between {minFactor.toFixed(2)}x and {maxFactor.toFixed(2)}x the set value.
        </p>
      </div>
      
      {!isConnected && (
        <div className="text-red-500 text-sm">
          Connect to the server to modify timing settings
        </div>
      )}
    </Card>
  );
};

export default RandomTimingPanel; 