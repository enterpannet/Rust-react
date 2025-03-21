import React from 'react';
import { Card, Slider, InputNumber, Typography, Space, Button, Tooltip } from 'antd';
import { ClockCircleOutlined, PlusOutlined, PlusSquareOutlined } from '@ant-design/icons';

const { Title } = Typography;

interface WaitTimePanelProps {
  waitTime: number;
  isConnected: boolean;
  selectedSteps: string[];
  onWaitTimeChange: (value: number) => void;
  onAddWaitTime: (stepType: string, data?: Record<string, any>) => void;
  onAddWaitBetweenSelected?: (waitTime: number) => void;
}

const WaitTimePanel: React.FC<WaitTimePanelProps> = ({ 
  waitTime, 
  isConnected,
  selectedSteps = [],
  onWaitTimeChange,
  onAddWaitTime,
  onAddWaitBetweenSelected
}) => {
  const handleInputChange = (value: number | null) => {
    if (value !== null) {
      onWaitTimeChange(value);
    }
  };
  
  const handleAddWaitTime = () => {
    onAddWaitTime('wait', { wait_time: waitTime });
  };

  const handleAddWaitBetweenSelected = () => {
    if (onAddWaitBetweenSelected && selectedSteps.length >= 2) {
      onAddWaitBetweenSelected(waitTime);
    }
  };
  
  return (
    <Card 
      title={
        <Space>
          <ClockCircleOutlined />
          <Title level={4} className="m-0">Wait Time</Title>
        </Space>
      } 
      className="w-full h-full"
    >
      <div className="mb-2">
        <p className="text-gray-600">Set the wait time (seconds) between automation steps:</p>
      </div>
      
      <div className="flex items-center gap-4">
        <Slider
          min={0}
          max={120}
          step={0.1}
          value={waitTime}
          onChange={handleInputChange}
          className="flex-1"
          tooltip={{ formatter: (value) => `${value}s` }}
          disabled={!isConnected}
        />
        <InputNumber
          min={0}
          max={100000}
          step={0.1}
          value={waitTime}
          onChange={handleInputChange}
          addonAfter="sec"
          style={{ width: '100px' }}
          disabled={!isConnected}
        />
      </div>
      
      <div className="mt-4 flex flex-col justify-end gap-2">
  
          <Tooltip title="Add wait time between selected steps">
            <Button
              type="primary"
              icon={<PlusSquareOutlined />}
              onClick={handleAddWaitBetweenSelected}
              disabled={!isConnected || selectedSteps.length < 2}
            >
              Add Between Selected
            </Button>
          </Tooltip>
       
        
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAddWaitTime}
          disabled={!isConnected}
        >
          Add Wait Step
        </Button>
      </div>
      
      {/* <div className="mt-4">
        <p className="text-xs text-gray-500">
          This delay will be applied after each action in your automation sequence.
          Longer delays give you more time to observe each step.
        </p>
        
        {!isConnected && (
          <p className="text-red-500 text-sm mt-2">
            Connect to the server to modify wait time
          </p>
        )}
      </div> */}
    </Card>
  );
};

export default WaitTimePanel; 