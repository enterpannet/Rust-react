import React, { useState } from 'react';
import { Button, Space, Tooltip, Popconfirm } from 'antd';
import { 
  DeleteOutlined, 
  CopyOutlined, 
  ScissorOutlined, 
  FileAddOutlined,
  ClearOutlined
} from '@ant-design/icons';
import { Step } from '../types';

interface StepsListControlsProps {
  selectedSteps: string[];
  steps: Step[];
  onClearAllSteps: () => void;
  onDeleteSelectedSteps: (stepIds: string[]) => void;
  onCopySelectedSteps?: (steps: Step[]) => void;
  onPasteSteps?: (steps: Step[], afterStepId?: string) => void;
  copiedSteps?: Step[];
}

const StepsListControls: React.FC<StepsListControlsProps> = ({
  selectedSteps,
  steps,
  onClearAllSteps,
  onDeleteSelectedSteps,
  onCopySelectedSteps,
  onPasteSteps,
  copiedSteps = []
}) => {
  const handleCopySteps = () => {
    if (selectedSteps.length > 0 && onCopySelectedSteps) {
      const stepsToCopy = steps.filter(step => selectedSteps.includes(step.id));
      onCopySelectedSteps(stepsToCopy);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedSteps.length > 0) {
      onDeleteSelectedSteps(selectedSteps);
    }
  };

  const handlePasteSteps = () => {
    if (onPasteSteps && copiedSteps.length > 0) {
      if (selectedSteps.length > 0) {
        let lastSelectedIndex = -1;
        let lastSelectedStepId = '';
        
        selectedSteps.forEach(stepId => {
          const index = steps.findIndex(step => step.id === stepId);
          if (index > lastSelectedIndex) {
            lastSelectedIndex = index;
            lastSelectedStepId = stepId;
          }
        });
        
        onPasteSteps(copiedSteps, lastSelectedStepId);
      } else {
        onPasteSteps(copiedSteps);
      }
    }
  };

  return (
    <Space className="mb-2">
      <Tooltip title="ลบขั้นตอนที่เลือก">
        <Popconfirm
          title="คุณแน่ใจหรือไม่ที่จะลบขั้นตอนที่เลือก?"
          onConfirm={handleDeleteSelected}
          okText="ใช่"
          cancelText="ไม่"
          disabled={selectedSteps.length === 0}
        >
          <Button 
            danger 
            icon={<ScissorOutlined />} 
            disabled={selectedSteps.length === 0}
          >
            ลบที่เลือก
          </Button>
        </Popconfirm>
      </Tooltip>

      <Tooltip title="ลบขั้นตอนทั้งหมด">
        <Popconfirm
          title="คุณแน่ใจหรือไม่ที่จะลบขั้นตอนทั้งหมด?"
          onConfirm={onClearAllSteps}
          okText="ใช่"
          cancelText="ไม่"
          disabled={steps.length === 0}
        >
          <Button 
            danger 
            icon={<ClearOutlined />} 
            disabled={steps.length === 0}
          >
            ลบทั้งหมด
          </Button>
        </Popconfirm>
      </Tooltip>

      <Tooltip title="คัดลอกขั้นตอนที่เลือก">
        <Button 
          icon={<CopyOutlined />} 
          onClick={handleCopySteps}
          disabled={selectedSteps.length === 0 || !onCopySelectedSteps}
        >
          คัดลอก
        </Button>
      </Tooltip>

      <Tooltip title="วางต่อจากขั้นตอนที่เลือก">
        <Button 
          icon={<FileAddOutlined />} 
          onClick={handlePasteSteps}
          disabled={copiedSteps.length === 0 || !onPasteSteps}
        >
          วาง
        </Button>
      </Tooltip>
    </Space>
  );
};

export default StepsListControls; 