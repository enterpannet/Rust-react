import React from 'react';
import { Card, Typography, Progress, Space, Badge } from 'antd';
import { Step } from '../types';

const { Title, Text } = Typography;

interface ProgressPanelProps {
  steps: Step[];
  currentStep: number | null;
  isRunning: boolean;
  status: string;
  completedSteps?: number;
  totalSteps?: number;
}

const ProgressPanel: React.FC<ProgressPanelProps> = ({ 
  steps, 
  currentStep, 
  isRunning,
  status,
  completedSteps = 0,
  totalSteps = 0
}) => {
  // คำนวณความคืบหน้า
  const calculateProgress = () => {
    // ใช้ totalSteps ถ้ามีค่า ไม่งั้นใช้จำนวนใน steps array
    const total = totalSteps > 0 ? totalSteps : steps.length;
    if (total === 0) return 0;
    
    // ถ้ามีค่า completedSteps ให้ใช้ค่านั้น
    if (completedSteps > 0) {
      return Math.round((completedSteps / total) * 100);
    }
    
    // ถ้าไม่มี ใช้ค่า currentStep แทน
    if (currentStep === null) return 0;
    if (isRunning && currentStep < 0) return 0;
    
    // คำนวณเป็นเปอร์เซ็นต์
    return Math.round(((currentStep + 1) / total) * 100);
  };
  
  // หาขั้นตอนปัจจุบัน
  const getCurrentStepDescription = () => {
    if (!isRunning || currentStep === null || currentStep < 0 || currentStep >= steps.length) {
      return 'ไม่มีการทำงาน';
    }
    
    const step = steps[currentStep];
    
    switch (step.type) {
      case 'mouse_move':
        return `กำลังเลื่อนเมาส์ไปที่ X: ${step.data.x}, Y: ${step.data.y}`;
      case 'mouse_click': {
        const button = typeof step.data.button === 'string' ? step.data.button : 'Left';
        return `กำลังคลิกเมาส์ ${button} ที่ตำแหน่งปัจจุบัน`;
      }
      case 'mouse_double_click':
        return 'กำลังดับเบิลคลิกที่ตำแหน่งปัจจุบัน';
      case 'key_press':
        return `กำลังกดปุ่ม "${step.data.key}"`;
      case 'wait':
        return `กำลังรอ ${step.data.wait_time} วินาที`;
      case 'group': {
        const groupSteps = step.data.groupSteps || [];
        const loopCount = step.data.groupLoopCount || 1;
        return `กำลังทำงานกลุ่ม ${step.data.groupName || 'Group'} (${groupSteps.length} ขั้นตอน, ${loopCount} รอบ)`;
      }
      default:
        return 'กำลังทำงาน';
    }
  };
  
  const progress = calculateProgress();
  
  return (
    <Card 
   
      className="w-full"
    >
      <div className="flex flex-col gap-4">
        <Progress 
          percent={progress} 
          status={isRunning ? 'active' : (progress === 100 ? 'success' : 'normal')}
          strokeColor={status === 'running' ? '#1890ff' : '#52c41a'}
        />
        
        <div className="flex justify-between">
          <Text>
            ขั้นตอน: {(currentStep !== null && currentStep >= 0) ? currentStep + 1 : 0} / {totalSteps > 0 ? totalSteps : steps.length}
          </Text>
          <Text type="secondary">
            สำเร็จ: {completedSteps} ขั้นตอน
          </Text>
        </div>
        
        <div className="mt-2">
          <Text strong>กำลังทำ: </Text>
          <Text>{getCurrentStepDescription()}</Text>
        </div>
      </div>
    </Card>
  );
};

export default ProgressPanel; 