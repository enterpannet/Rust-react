import React, { useState } from 'react';
import { Card, Button, InputNumber, Space, Typography, Badge, Checkbox } from 'antd';
import {
  PlayCircleOutlined,
  StopOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { Step } from '../types';

const { Title } = Typography;

interface ControlPanelProps {
  status: string;
  isRunning: boolean;
  steps: Step[];
  loopCount: number;
  setLoopCount: React.Dispatch<React.SetStateAction<number>>;
  onRunAutomation: () => void;
  onStopAutomation: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  status,
  isRunning,
  steps,
  loopCount,
  setLoopCount,
  onRunAutomation,
  onStopAutomation
}) => {
  const [infiniteLoop, setInfiniteLoop] = useState(false);

  const handleRunAutomation = () => {
    // ถ้าเป็นโหมดไม่จำกัดรอบ ส่งค่า -1 ไปยัง backend
    if (infiniteLoop) {
      // ใช้ค่าพิเศษ -1 สำหรับ infinite loop
      // ต้องแก้ไข backend ให้รองรับด้วย
      setLoopCount(-1);
      onRunAutomation();
      // หลังจากทำงานเสร็จ กลับมาตั้งค่าเป็นค่าปกติ
      setLoopCount(1);
    } else {
      onRunAutomation();
    }
  };

  return (
    <Card className="w-full">
      <div className="flex flex-col items-center w-full">
        <Space className='flex flex-row items-center justify-between gap-5 w-full'>
          <Space>
            <Badge status={status === 'idle' ? 'default' : status === 'running' ? 'processing' : 'warning'} />
            <span className="font-semibold">Status: {status}</span>
          </Space>
          <Checkbox
            checked={infiniteLoop}
            onChange={(e) => setInfiniteLoop(e.target.checked)}
            disabled={isRunning}
          >
            ไม่จำกัดรอบ
          </Checkbox>
        </Space>



        <Space className='flex flex-row items-center justify-between gap-5 w-full'>

          <InputNumber
            min={1}
            max={100}
            value={loopCount}
            onChange={(value) => setLoopCount(value || 1)}
            style={{ width: 150 }}
            disabled={isRunning || infiniteLoop}
            addonAfter="loops"
          />


          <Button
            type="primary"
            icon={infiniteLoop ? <ReloadOutlined /> : <PlayCircleOutlined />}
            onClick={handleRunAutomation}
            disabled={isRunning || steps.length === 0}
          >
            {infiniteLoop ? "Run" : "Run"}
          </Button>


          <Button
            danger
            icon={<StopOutlined />}
            onClick={onStopAutomation}
            disabled={!isRunning}
          >
            Stop
          </Button>

        </Space>

      </div>
    </Card>
  );
};

export default ControlPanel; 