import React, { useState } from 'react';
import { Card, List, Badge, Typography, Space, Tag, Checkbox, Button, Tooltip, Popconfirm } from 'antd';
import { 
  KeyOutlined, 
  ClockCircleOutlined,
  AimOutlined,
  PlayCircleOutlined,
  MenuOutlined,
  DeleteOutlined, 
  CopyOutlined, 
  ScissorOutlined, 
  FileAddOutlined,
  ClearOutlined
} from '@ant-design/icons';
import { Step } from '../types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import StepsListControls from './StepsListControls';
import { motion, useAnimation, Reorder } from "framer-motion";

const { Title, Text } = Typography;

// Props interface for DraggableStepItem component
interface DraggableStepItemProps {
  step: Step;
  index: number;
  children: React.ReactNode;
}

// Draggable step item component with restricted horizontal movement
const DraggableStepItem: React.FC<DraggableStepItemProps> = ({ step, index, children }) => {
  return (
    <Reorder.Item
      key={step.id}
      value={step}
      style={{
        width: '100%',
        x: 0, // Force x position to be 0
        touchAction: 'pan-y', // Allow only vertical panning on touch devices
        cursor: 'grab'
      }}
      dragListener={true}
      dragControls={undefined}
      drag="y"
      dragDirectionLock
    >
      {children}
    </Reorder.Item>
  );
};

interface StepsListProps {
  steps: Step[];
  currentStep: number | null;
  onRunSelectedSteps?: (selectedIds: string[]) => void;
  onReorderSteps?: (reorderedSteps: Step[]) => void;
  onClearAllSteps?: () => void;
  onDeleteSelectedSteps?: (stepIds: string[]) => void;
  onCopySelectedSteps?: (steps: Step[]) => void;
  onPasteSteps?: (steps: Step[], afterStepId?: string) => void;
}

// Define SortableItem props interface
interface SortableItemProps {
  step: Step;
  index: number;
  currentStep: number | null;
  selectedSteps: string[];
  toggleStepSelection: (id: string) => void;
  getStepIcon: (type: string) => React.ReactNode;
  getStepDescription: (step: Step) => string;
  getWaitTimeTag: (step: Step) => React.ReactNode;
}

// สร้าง SortableItem component
const SortableItem: React.FC<SortableItemProps> = ({ step, index, currentStep, selectedSteps, toggleStepSelection, getStepIcon, getStepDescription, getWaitTimeTag }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: step.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div 
        className={`${currentStep === index ? 'bg-blue-50' : ''} ${selectedSteps.includes(step.id) ? 'bg-gray-100 border-blue-400' : ''} rounded mb-1 border border-gray-200 cursor-move p-4`}
        {...listeners}
        onClick={(e) => {
          if (e.target === e.currentTarget || !e.defaultPrevented) {
            toggleStepSelection(step.id);
          }
        }}
      >
        <div className="flex items-center w-full">
          <div className="flex items-center">
            <div className="mr-4">
              <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full">
                {currentStep === index ? (
                  <Badge status="processing" />
                ) : (
                  <Text type="secondary">{index + 1}</Text>
                )}
              </div>
            </div>
            <div>
              <div className="font-medium">
                <Space>
                  {getStepIcon(step.type)}
                  <span>{getStepDescription(step)}</span>
                </Space>
              </div>
              <div className="text-sm text-gray-500">
                {getWaitTimeTag(step)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StepsList: React.FC<StepsListProps> = ({ 
  steps, 
  currentStep, 
  onRunSelectedSteps,
  onReorderSteps,
  onClearAllSteps,
  onDeleteSelectedSteps,
  onCopySelectedSteps,
  onPasteSteps
}) => {
  const [selectedSteps, setSelectedSteps] = useState<string[]>([]);
  const [copiedSteps, setCopiedSteps] = useState<Step[]>([]);
  
  // กำหนด sensors สำหรับ drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Toggle step selection
  const toggleStepSelection = (stepId: string) => {
    if (selectedSteps.includes(stepId)) {
      setSelectedSteps(selectedSteps.filter(id => id !== stepId));
    } else {
      setSelectedSteps([...selectedSteps, stepId]);
    }
  };
  
  // Run selected steps
  const handleRunSelected = () => {
    if (onRunSelectedSteps && selectedSteps.length > 0) {
      onRunSelectedSteps(selectedSteps);
    }
  };
  
  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      // หา index ของ items
      const oldIndex = steps.findIndex(step => step.id === active.id);
      const newIndex = steps.findIndex(step => step.id === over.id);
      
      // สร้าง array ใหม่ที่มีลำดับเปลี่ยนไป
      const newSteps = arrayMove(steps, oldIndex, newIndex);
      
      // ส่งไปให้ parent component จัดการ
      if (onReorderSteps) {
        onReorderSteps(newSteps);
      }
    }
  };
  
  // Handle copy selected steps
  const handleCopySelectedSteps = (stepsToCopy: Step[]) => {
    setCopiedSteps(stepsToCopy);
    if (onCopySelectedSteps) {
      onCopySelectedSteps(stepsToCopy);
    }
  };

  // Handle paste steps
  const handlePasteSteps = (stepsToPaste: Step[]) => {
    if (onPasteSteps && stepsToPaste.length > 0) {
      // ถ้ามีขั้นตอนที่เลือกอยู่ จะวางต่อจากขั้นตอนสุดท้ายที่เลือก
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
        
        onPasteSteps(stepsToPaste, lastSelectedStepId);
      } else {
        // ถ้าไม่มีการเลือก วางต่อท้าย
        onPasteSteps(stepsToPaste);
      }
    } else if (onReorderSteps && stepsToPaste.length > 0) {
      // กรณีไม่มี onPasteSteps ให้ใช้ onReorderSteps แทน (legacy)
      const newPastedSteps = stepsToPaste.map(step => ({
        ...step,
        id: Date.now() + Math.random().toString(36).substring(2, 9)
      }));
      
      const newSteps = [...steps, ...newPastedSteps];
      onReorderSteps(newSteps);
    }
  };

  // Handle delete selected steps
  const handleDeleteSelectedSteps = (stepIds: string[]) => {
    if (onReorderSteps) {
      const newSteps = steps.filter(step => !stepIds.includes(step.id));
      onReorderSteps(newSteps);
      // เคลียร์ selected steps หลังจากลบ
      setSelectedSteps([]);
    } else if (onDeleteSelectedSteps) {
      onDeleteSelectedSteps(stepIds);
      setSelectedSteps([]);
    }
  };
  
  const getStepIcon = (type: string) => {
    switch (type) {
      case 'mouse_move':
        return <AimOutlined />;
      case 'mouse_click':
      case 'mouse_double_click':
        return <AimOutlined />;
      case 'key_press':
        return <KeyOutlined />;
      default:
        return <ClockCircleOutlined />;
    }
  };
  
  const getStepDescription = (step: Step) => {
    switch (step.type) {
      case 'mouse_move':
        return `Move to X: ${step.data.x}, Y: ${step.data.y}`;
      case 'mouse_click': {
        // Safe handling of button property
        const button = typeof step.data.button === 'string' ? step.data.button : 'Left';
        return `${button.charAt(0).toUpperCase() + button.slice(1)} click at current position`;
      }
      case 'mouse_double_click':
        return 'Double click at current position';
      case 'key_press':
        return `Press key "${step.data.key}"`;
      default:
        return 'Unknown action';
    }
  };
  
  const getWaitTimeTag = (step: Step) => {
    return (
      <Tag color="blue">
        <ClockCircleOutlined /> Wait: {step.data.wait_time}s
        {step.data.randomize && ' (Random)'}
      </Tag>
    );
  };
  
  return (
    <Card 
      title={
        <div className="flex justify-between items-center">
          <Space className="flex flex-row items-center justify-center">
            <Title level={4} className="m-0">ขั้นตอนการทำงาน</Title>
            <Badge count={steps.length} showZero />
            <Badge count={selectedSteps.length} style={{ backgroundColor: '#1890ff' }} />
           
          </Space>
        </div>
      } 
      className="w-full h-[550px] flex flex-col"
      bodyStyle={{ padding: '12px', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
    >
      <div className="flex-1 overflow-y-auto mb-3">
        {steps.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>ไม่มีขั้นตอนที่เพิ่มไว้</p>
            <p>เพิ่มขั้นตอนใหม่โดยใช้แผงด้านซ้าย</p>
          </div>
        ) : (
          <Reorder.Group 
            values={steps} 
            onReorder={(newOrder) => onReorderSteps && onReorderSteps(newOrder)}
            axis="y"
            layoutScroll
            style={{ 
              width: '100%', 
              maxWidth: '100%', 
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {steps.map((step, index) => (
              <DraggableStepItem 
                key={step.id} 
                step={step}
                index={index}
              >
                <SortableItem 
                  step={step} 
                  index={index}
                  currentStep={currentStep}
                  selectedSteps={selectedSteps}
                  toggleStepSelection={toggleStepSelection}
                  getStepIcon={getStepIcon}
                  getStepDescription={getStepDescription}
                  getWaitTimeTag={getWaitTimeTag}
                />
              </DraggableStepItem>
            ))}
          </Reorder.Group>
        )}
      </div>
      
      <div className="control border-t pt-3 mt-auto">
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2 flex justify-between mb-2">
            <Tooltip title="ลบขั้นตอนที่เลือก">
              <Popconfirm
                title="คุณแน่ใจหรือไม่ที่จะลบขั้นตอนที่เลือก?"
                onConfirm={() => handleDeleteSelectedSteps(selectedSteps)}
                okText="ใช่"
                cancelText="ไม่"
                disabled={selectedSteps.length === 0}
              >
                <Button 
                  danger 
                  icon={<ScissorOutlined />} 
                  size="small"
                  disabled={selectedSteps.length === 0 || steps.length === 0}
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
                  size="small"
                  disabled={steps.length === 0}
                >
                  ลบทั้งหมด
                </Button>
              </Popconfirm>
            </Tooltip>
          </div>

          <Tooltip title="คัดลอกขั้นตอนที่เลือก">
            <Button 
              icon={<CopyOutlined />}
              size="small" 
              onClick={() => {
                const stepsToCopy = steps.filter(step => selectedSteps.includes(step.id));
                handleCopySelectedSteps(stepsToCopy);
              }}
              disabled={selectedSteps.length === 0 || steps.length === 0}
              block
            >
              คัดลอก
            </Button>
          </Tooltip>

          <Tooltip title="วางขั้นตอนที่คัดลอก">
            <Button 
              icon={<FileAddOutlined />}
              size="small" 
              onClick={() => handlePasteSteps(copiedSteps)}
              disabled={copiedSteps.length === 0 || steps.length === 0}
              block
            >
              วาง
            </Button>
          </Tooltip>

          <div className="col-span-2 mt-2">
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleRunSelected}
              disabled={selectedSteps.length === 0 || steps.length === 0}
              block
            >
              รันที่เลือก
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default StepsList; 