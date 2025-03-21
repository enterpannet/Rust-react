import React, { useState, useRef } from 'react';
import { Card, List, Badge, Typography, Space, Tag, Checkbox, Button, Tooltip, Popconfirm, InputNumber, Modal, Input, Form, Tabs, Table, Switch, message } from 'antd';
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
  ClearOutlined,
  GroupOutlined,
  UngroupOutlined,
  PlusOutlined,
  EditOutlined,
  RightOutlined,
  DownOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  SettingOutlined,
  SaveOutlined,
  UploadOutlined
} from '@ant-design/icons';
import { Step, StepGroup } from '../types';
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
  onStepsSelection?: (selectedIds: string[]) => void;
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
  onPasteSteps,
  onStepsSelection
}) => {
  const [selectedSteps, setSelectedSteps] = useState<string[]>([]);
  const [copiedSteps, setCopiedSteps] = useState<Step[]>([]);
  const [groupNameModalVisible, setGroupNameModalVisible] = useState(false);
  const [currentGroupId, setCurrentGroupId] = useState<string>('');
  const [groupName, setGroupName] = useState<string>('New Group');
  
  // เพิ่ม state สำหรับ Group Editor Modal
  const [groupEditorVisible, setGroupEditorVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Step | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [editingGroupLoopCount, setEditingGroupLoopCount] = useState(1);
  const [availableSteps, setAvailableSteps] = useState<Step[]>([]);
  const [editingGroupSteps, setEditingGroupSteps] = useState<Step[]>([]);
  
  // กำหนด sensors สำหรับ drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // เพิ่ม ref สำหรับอัพโหลดไฟล์
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Toggle step selection
  const toggleStepSelection = (stepId: string) => {
    let newSelectedSteps: string[];
    if (selectedSteps.includes(stepId)) {
      newSelectedSteps = selectedSteps.filter(id => id !== stepId);
    } else {
      newSelectedSteps = [...selectedSteps, stepId];
    }
    setSelectedSteps(newSelectedSteps);
    
    // ส่งค่าไปยัง App component
    if (onStepsSelection) {
      onStepsSelection(newSelectedSteps);
    }
  };
  
  // เพิ่มฟังก์ชันสำหรับเปิด Group Editor Modal
  const openGroupEditor = (groupId: string) => {
    const group = steps.find(step => step.id === groupId);
    if (!group || group.type !== 'group') return;
    
    setEditingGroup(group);
    setEditingGroupName(group.data.groupName || 'Group');
    setEditingGroupLoopCount(group.data.groupLoopCount || 1);
    setEditingGroupSteps(group.data.groupSteps || []);
    
    // กรองขั้นตอนที่ไม่ได้อยู่ในกลุ่มเพื่อเตรียมไว้ให้เลือกเพิ่ม
    const stepsNotInGroup = steps.filter(step => 
      step.id !== groupId && // ไม่ใช่กลุ่มที่กำลังแก้ไข
      step.type !== 'group' && // ไม่ใช่กลุ่มอื่นๆ
      !(group.data.groupSteps || []).some((groupStep: Step) => groupStep.id === step.id) // ไม่ได้อยู่ในกลุ่มนี้อยู่แล้ว
    );
    
    setAvailableSteps(stepsNotInGroup);
    setGroupEditorVisible(true);
  };
  
  // เพิ่มฟังก์ชันสำหรับเพิ่มขั้นตอนเข้าไปในกลุ่มที่กำลังแก้ไข
  const addStepToEditingGroup = (stepId: string) => {
    const stepToAdd = availableSteps.find(step => step.id === stepId);
    if (!stepToAdd) return;
    
    // เพิ่มขั้นตอนเข้าไปในกลุ่ม
    setEditingGroupSteps(prev => [...prev, stepToAdd]);
    
    // ลบขั้นตอนออกจากรายการ available
    setAvailableSteps(prev => prev.filter(step => step.id !== stepId));
  };
  
  // เพิ่มฟังก์ชันสำหรับลบขั้นตอนออกจากกลุ่มที่กำลังแก้ไข
  const removeStepFromEditingGroup = (stepId: string) => {
    const stepToRemove = editingGroupSteps.find(step => step.id === stepId);
    if (!stepToRemove) return;
    
    // ลบขั้นตอนออกจากกลุ่ม
    setEditingGroupSteps(prev => prev.filter(step => step.id !== stepId));
    
    // เพิ่มขั้นตอนกลับเข้าไปในรายการ available
    setAvailableSteps(prev => [...prev, stepToRemove]);
  };
  
  // เพิ่มฟังก์ชันสำหรับย้ายขั้นตอนในกลุ่มขึ้น
  const moveStepUp = (stepId: string) => {
    const index = editingGroupSteps.findIndex(step => step.id === stepId);
    if (index <= 0) return;
    
    const newSteps = [...editingGroupSteps];
    [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
    setEditingGroupSteps(newSteps);
  };
  
  // เพิ่มฟังก์ชันสำหรับย้ายขั้นตอนในกลุ่มลง
  const moveStepDown = (stepId: string) => {
    const index = editingGroupSteps.findIndex(step => step.id === stepId);
    if (index === -1 || index >= editingGroupSteps.length - 1) return;
    
    const newSteps = [...editingGroupSteps];
    [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
    setEditingGroupSteps(newSteps);
  };
  
  // เพิ่มฟังก์ชันสำหรับบันทึกการแก้ไขกลุ่ม
  const saveGroupChanges = () => {
    if (!editingGroup) return;
    
    const updatedSteps = [...steps];
    const groupIndex = updatedSteps.findIndex(step => step.id === editingGroup.id);
    
    if (groupIndex !== -1) {
      updatedSteps[groupIndex] = {
        ...updatedSteps[groupIndex],
        data: {
          ...updatedSteps[groupIndex].data,
          groupName: editingGroupName,
          groupLoopCount: editingGroupLoopCount,
          groupSteps: editingGroupSteps
        }
      };
      
      if (onReorderSteps) {
        onReorderSteps(updatedSteps);
      }
    }
    
    setGroupEditorVisible(false);
  };

  // Define Group Item props interface
  interface GroupItemProps {
    step: Step;
    index: number;
    currentStep: number | null;
    selectedSteps: string[];
    toggleStepSelection: (id: string) => void;
    getStepIcon: (type: string) => React.ReactNode;
    getStepDescription: (step: Step) => string;
    getWaitTimeTag: (step: Step) => React.ReactNode;
    onUpdateGroupLoopCount: (groupId: string, loopCount: number) => void;
    onRenameGroup: (groupId: string, newName: string) => void;
    onDeleteGroup: (groupId: string) => void;
    onToggleGroupCollapse: (groupId: string) => void;
    onReorderGroupSteps?: (groupId: string, reorderedSteps: Step[]) => void;
    onAddStepToGroup?: (groupId: string) => void;
  }

  // Group item component
  const GroupItem: React.FC<GroupItemProps> = ({
    step,
    index,
    currentStep,
    selectedSteps,
    toggleStepSelection,
    getStepIcon,
    getStepDescription,
    getWaitTimeTag,
    onUpdateGroupLoopCount,
    onRenameGroup,
    onDeleteGroup,
    onToggleGroupCollapse,
    onReorderGroupSteps,
    onAddStepToGroup
  }) => {
    const isCollapsed = step.data.collapsed || false;
    const groupSteps = step.data.groupSteps || [];
    const groupLoopCount = step.data.groupLoopCount || 1;
    const groupName = step.data.groupName || 'Group';

    return (
      <div 
        className={`group-container border border-blue-400 rounded p-2 mb-2 ${selectedSteps.includes(step.id) ? 'bg-blue-50' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            toggleStepSelection(step.id);
          }
        }}
      >
        <div className="group-header flex justify-between items-center bg-blue-50 p-2 rounded">
          <div className="flex items-center">
            <Button 
              type="text" 
              icon={isCollapsed ? <RightOutlined /> : <DownOutlined />}
              onClick={() => onToggleGroupCollapse(step.id)}
            />
            <span className="font-bold ml-2">{groupName}</span>
            <Tag color="blue" className="ml-2">Loop: {groupLoopCount}</Tag>
          </div>
          
          <Space>
            <InputNumber 
              min={1} 
              max={100} 
              value={groupLoopCount} 
              onChange={(value) => onUpdateGroupLoopCount(step.id, value || 1)}
              size="small"
              addonAfter="loops"
            />
            <Button 
              size="small" 
              icon={<EditOutlined />} 
              onClick={() => onRenameGroup(step.id, groupName)}
            />
            <Button 
              size="small"
              icon={<SettingOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                openGroupEditor(step.id);
              }}
            />
            <Button 
              size="small" 
              danger 
              icon={<DeleteOutlined />} 
              onClick={() => onDeleteGroup(step.id)}
            />
          </Space>
        </div>
        
        {!isCollapsed && (
          <div className="group-content p-2 ml-4 border-l-2 border-blue-200">
            {groupSteps.length > 0 ? (
              <Reorder.Group
                values={groupSteps}
                onReorder={(newOrder) => onReorderGroupSteps && onReorderGroupSteps(step.id, newOrder)}
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
                {groupSteps.map((groupStep, groupIndex) => (
                  <DraggableStepItem
                    key={groupStep.id}
                    step={groupStep}
                    index={groupIndex}
                  >
                    <SortableItem
                      step={groupStep}
                      index={groupIndex}
                      currentStep={currentStep === groupIndex ? groupIndex : null}
                      selectedSteps={selectedSteps}
                      toggleStepSelection={toggleStepSelection}
                      getStepIcon={getStepIcon}
                      getStepDescription={getStepDescription}
                      getWaitTimeTag={getWaitTimeTag}
                    />
                  </DraggableStepItem>
                ))}
              </Reorder.Group>
            ) : (
              <div className="text-center text-gray-500 py-2">
                <p>ไม่มีขั้นตอนในกลุ่มนี้</p>
                <Button 
                  type="dashed" 
                  icon={<PlusOutlined />}
                  onClick={() => onAddStepToGroup && onAddStepToGroup(step.id)}
                >
                  เพิ่มขั้นตอน
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };
  
  // ฟังก์ชัน: สร้างกลุ่มใหม่จากขั้นตอนที่เลือก
  const createNewGroup = () => {
    if (selectedSteps.length === 0) return;
    
    // เปิด Modal ให้ใส่ชื่อกลุ่ม
    setGroupName('New Group');
    setGroupNameModalVisible(true);
  };
  
  // ฟังก์ชัน: สร้างกลุ่มเมื่อกดยืนยันในโมดอล
  const confirmCreateGroup = () => {
    if (selectedSteps.length === 0) return;
    
    // คัดลอก steps ที่เลือก
    const selectedStepsCopy = steps.filter(step => selectedSteps.includes(step.id));
    
    // สร้าง id สำหรับกลุ่มใหม่
    const groupId = Date.now() + Math.random().toString(36).substring(2, 9);
    
    // สร้าง group step
    const groupStep: Step = {
      id: groupId,
      type: 'group',
      data: {
        wait_time: 0,
        randomize: false,
        isGroup: true,
        groupName: groupName,
        groupSteps: selectedStepsCopy,
        groupLoopCount: 1,
        collapsed: false
      }
    };
    
    // ลบ steps ที่เลือกออกจาก steps หลัก และเพิ่ม group step แทน
    const newSteps = steps.filter(step => !selectedSteps.includes(step.id));
    newSteps.push(groupStep);
    
    // อัพเดต steps
    if (onReorderSteps) {
      onReorderSteps(newSteps);
    }
    
    // ล้างการเลือก
    setSelectedSteps([]);
    if (onStepsSelection) {
      onStepsSelection([]);
    }
    
    // ปิด Modal
    setGroupNameModalVisible(false);
  };
  
  // ฟังก์ชัน: เปลี่ยนจำนวนรอบของกลุ่ม
  const updateGroupLoopCount = (groupId: string, loopCount: number) => {
    const updatedSteps = [...steps];
    const groupIndex = updatedSteps.findIndex(step => step.id === groupId);
    
    if (groupIndex !== -1) {
      updatedSteps[groupIndex] = {
        ...updatedSteps[groupIndex],
        data: {
          ...updatedSteps[groupIndex].data,
          groupLoopCount: loopCount
        }
      };
      
      if (onReorderSteps) {
        onReorderSteps(updatedSteps);
      }
    }
  };
  
  // ฟังก์ชัน: เปลี่ยนชื่อกลุ่ม
  const renameGroup = (groupId: string, currentName: string) => {
    setCurrentGroupId(groupId);
    setGroupName(currentName);
    setGroupNameModalVisible(true);
  };
  
  // ฟังก์ชัน: ยืนยันการเปลี่ยนชื่อกลุ่ม
  const confirmRenameGroup = () => {
    if (!currentGroupId) return;
    
    const updatedSteps = [...steps];
    const groupIndex = updatedSteps.findIndex(step => step.id === currentGroupId);
    
    if (groupIndex !== -1) {
      updatedSteps[groupIndex] = {
        ...updatedSteps[groupIndex],
        data: {
          ...updatedSteps[groupIndex].data,
          groupName: groupName
        }
      };
      
      if (onReorderSteps) {
        onReorderSteps(updatedSteps);
      }
    }
    
    setGroupNameModalVisible(false);
    setCurrentGroupId('');
  };
  
  // ฟังก์ชัน: ลบกลุ่ม (เก็บขั้นตอนภายในไว้)
  const deleteGroup = (groupId: string) => {
    const groupToDelete = steps.find(step => step.id === groupId);
    if (!groupToDelete || !groupToDelete.data.isGroup) return;
    
    const groupSteps = groupToDelete.data.groupSteps || [];
    const updatedSteps = steps.filter(step => step.id !== groupId);
    
    // เพิ่มขั้นตอนที่เคยอยู่ในกลุ่มกลับเข้าไปในรายการหลัก
    updatedSteps.push(...groupSteps);
    
    if (onReorderSteps) {
      onReorderSteps(updatedSteps);
    }
  };
  
  // ฟังก์ชัน: พับ/ขยายกลุ่ม
  const toggleGroupCollapse = (groupId: string) => {
    const updatedSteps = [...steps];
    const groupIndex = updatedSteps.findIndex(step => step.id === groupId);
    
    if (groupIndex !== -1) {
      updatedSteps[groupIndex] = {
        ...updatedSteps[groupIndex],
        data: {
          ...updatedSteps[groupIndex].data,
          collapsed: !updatedSteps[groupIndex].data.collapsed
        }
      };
      
      if (onReorderSteps) {
        onReorderSteps(updatedSteps);
      }
    }
  };
  
  // ฟังก์ชัน: เรียงลำดับขั้นตอนในกลุ่มใหม่
  const reorderGroupSteps = (groupId: string, reorderedSteps: Step[]) => {
    const updatedSteps = [...steps];
    const groupIndex = updatedSteps.findIndex(step => step.id === groupId);
    
    if (groupIndex !== -1) {
      updatedSteps[groupIndex] = {
        ...updatedSteps[groupIndex],
        data: {
          ...updatedSteps[groupIndex].data,
          groupSteps: reorderedSteps
        }
      };
      
      if (onReorderSteps) {
        onReorderSteps(updatedSteps);
      }
    }
  };
  
  // ฟังก์ชัน: เพิ่มขั้นตอนใหม่เข้าไปในกลุ่ม (ตัวอย่างเพิ่ม wait step)
  const addStepToGroup = (groupId: string) => {
    const updatedSteps = [...steps];
    const groupIndex = updatedSteps.findIndex(step => step.id === groupId);
    
    if (groupIndex !== -1) {
      const newStep: Step = {
        id: Date.now() + Math.random().toString(36).substring(2, 9),
        type: 'wait',
        data: {
          wait_time: 1,
          randomize: false
        }
      };
      
      const currentGroupSteps = [...(updatedSteps[groupIndex].data.groupSteps || [])];
      currentGroupSteps.push(newStep);
      
      updatedSteps[groupIndex] = {
        ...updatedSteps[groupIndex],
        data: {
          ...updatedSteps[groupIndex].data,
          groupSteps: currentGroupSteps
        }
      };
      
      if (onReorderSteps) {
        onReorderSteps(updatedSteps);
      }
    }
  };
  
  // ฟังก์ชัน: ตรวจสอบว่ามีกลุ่มที่เลือกอยู่หรือไม่
  const hasSelectedGroup = () => {
    return selectedSteps.some(id => {
      const step = steps.find(s => s.id === id);
      return step && step.data.isGroup;
    });
  };
  
  // ฟังก์ชัน: ยกเลิกกลุ่มที่เลือก (เอาขั้นตอนในกลุ่มออกมา)
  const ungroupSelected = () => {
    const selectedGroupIds = selectedSteps.filter(id => {
      const step = steps.find(s => s.id === id);
      return step && step.data.isGroup;
    });
    
    if (selectedGroupIds.length === 0) return;
    
    let updatedSteps = [...steps];
    
    selectedGroupIds.forEach(groupId => {
      const groupIndex = updatedSteps.findIndex(step => step.id === groupId);
      if (groupIndex === -1) return;
      
      const groupSteps = updatedSteps[groupIndex].data.groupSteps || [];
      
      // ลบกลุ่มออก
      updatedSteps = updatedSteps.filter(step => step.id !== groupId);
      
      // เพิ่มขั้นตอนในกลุ่มกลับเข้าไปในรายการหลัก
      updatedSteps.push(...groupSteps);
    });
    
    if (onReorderSteps) {
      onReorderSteps(updatedSteps);
    }
    
    // ล้างการเลือก
    setSelectedSteps([]);
    if (onStepsSelection) {
      onStepsSelection([]);
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
      if (onStepsSelection) {
        onStepsSelection([]);
      }
    } else if (onDeleteSelectedSteps) {
      onDeleteSelectedSteps(stepIds);
      setSelectedSteps([]);
      if (onStepsSelection) {
        onStepsSelection([]);
      }
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
      case 'wait':
        return <ClockCircleOutlined />;
      case 'group':
        return <GroupOutlined />;
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
      case 'wait':
        return `Wait for ${step.data.wait_time} seconds`;
      case 'group': {
        const groupSteps = step.data.groupSteps || [];
        const loopCount = step.data.groupLoopCount || 1;
        return `${step.data.groupName || 'Group'} (${groupSteps.length} steps, ${loopCount} loops)`;
      }
      default:
        return 'Unknown action';
    }
  };
  
  const getWaitTimeTag = (step: Step) => {
    if (!step.data.wait_time && step.type !== 'wait') {
      return null;
    }
    
    return (
      <Tag color="blue">
        <ClockCircleOutlined /> Wait: {step.data.wait_time}s
        {step.data.randomize && ' (Random)'}
      </Tag>
    );
  };

  // ฟังก์ชันสำหรับบันทึกขั้นตอนทั้งหมดเป็นไฟล์
  const handleSaveStepsToFile = () => {
    if (steps.length === 0) return;
    
    try {
      // เตรียมข้อมูลสำหรับบันทึก
      const stepsData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        steps: steps
      };
      
      // แปลงเป็น JSON
      const stepsJson = JSON.stringify(stepsData, null, 2);
      
      // สร้าง blob สำหรับดาวน์โหลด
      const blob = new Blob([stepsJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // สร้าง link สำหรับดาวน์โหลด
      const a = document.createElement('a');
      a.href = url;
      a.download = `automation_steps_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      
      // ทำความสะอาด
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
      
      message.success('บันทึกขั้นตอนทั้งหมดเรียบร้อย');
    } catch (error) {
      console.error('Error saving steps to file:', error);
      message.error('เกิดข้อผิดพลาดในการบันทึกไฟล์');
    }
  };
  
  // ฟังก์ชันสำหรับโหลดขั้นตอนจากไฟล์
  const handleLoadStepsFromFile = () => {
    // กระตุ้นให้เกิดการคลิกที่ input file ที่ซ่อนอยู่
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // ฟังก์ชันสำหรับประมวลผลไฟล์ที่อัพโหลด
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedData = JSON.parse(content);
        
        // ตรวจสอบว่าไฟล์มีโครงสร้างถูกต้อง
        if (!parsedData.steps || !Array.isArray(parsedData.steps)) {
          throw new Error('ไฟล์มีรูปแบบไม่ถูกต้อง');
        }
        
        // อัพเดตขั้นตอนจากไฟล์
        if (onReorderSteps) {
          onReorderSteps(parsedData.steps);
          
          // ล้างการเลือก
          setSelectedSteps([]);
          if (onStepsSelection) {
            onStepsSelection([]);
          }
          
          message.success(`โหลดขั้นตอนทั้งหมด ${parsedData.steps.length} ขั้นตอนเรียบร้อย`);
        }
      } catch (error) {
        console.error('Error loading steps from file:', error);
        message.error('เกิดข้อผิดพลาดในการโหลดไฟล์: ไฟล์อาจมีรูปแบบไม่ถูกต้อง');
      }
    };
    
    reader.onerror = () => {
      message.error('เกิดข้อผิดพลาดในการอ่านไฟล์');
    };
    
    reader.readAsText(file);
    
    // ล้างค่า input เพื่อให้สามารถเลือกไฟล์เดิมซ้ำได้
    event.target.value = '';
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
      styles={{ body: { padding: '12px', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' } }}
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
                {step.type === 'group' ? (
                  <GroupItem
                    step={step}
                    index={index}
                    currentStep={currentStep}
                    selectedSteps={selectedSteps}
                    toggleStepSelection={toggleStepSelection}
                    getStepIcon={getStepIcon}
                    getStepDescription={getStepDescription}
                    getWaitTimeTag={getWaitTimeTag}
                    onUpdateGroupLoopCount={updateGroupLoopCount}
                    onRenameGroup={renameGroup}
                    onDeleteGroup={deleteGroup}
                    onToggleGroupCollapse={toggleGroupCollapse}
                    onReorderGroupSteps={reorderGroupSteps}
                    onAddStepToGroup={addStepToGroup}
                  />
                ) : (
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
                )}
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
                onConfirm={() => {
                  if (onClearAllSteps) {
                    onClearAllSteps();
                    setSelectedSteps([]);
                    if (onStepsSelection) {
                      onStepsSelection([]);
                    }
                  }
                }}
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
          
          <Tooltip title="จัดกลุ่มขั้นตอนที่เลือก">
            <Button 
              icon={<GroupOutlined />}
              size="small" 
              onClick={createNewGroup}
              disabled={selectedSteps.length < 2}
              block
            >
              จัดกลุ่ม
            </Button>
          </Tooltip>
          
          <Tooltip title="ยกเลิกกลุ่มที่เลือก">
            <Button 
              icon={<UngroupOutlined />}
              size="small" 
              onClick={ungroupSelected}
              disabled={!hasSelectedGroup()}
              block
            >
              ยกเลิกกลุ่ม
            </Button>
          </Tooltip>

          <Tooltip title="บันทึกขั้นตอนทั้งหมดเป็นไฟล์">
            <Button 
              icon={<SaveOutlined />}
              size="small" 
              onClick={handleSaveStepsToFile}
              disabled={steps.length === 0}
              block
            >
              บันทึก
            </Button>
          </Tooltip>
          
          <Tooltip title="โหลดขั้นตอนจากไฟล์">
            <Button 
              icon={<UploadOutlined />}
              size="small" 
              onClick={handleLoadStepsFromFile}
              block
            >
              โหลด
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
      
      <Modal
        title={currentGroupId ? "เปลี่ยนชื่อกลุ่ม" : "สร้างกลุ่มใหม่"}
        open={groupNameModalVisible}
        onOk={currentGroupId ? confirmRenameGroup : confirmCreateGroup}
        onCancel={() => setGroupNameModalVisible(false)}
        okText="ยืนยัน"
        cancelText="ยกเลิก"
      >
        <Form>
          <Form.Item label="ชื่อกลุ่ม">
            <Input 
              value={groupName} 
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="ใส่ชื่อกลุ่ม"
              autoFocus
            />
          </Form.Item>
        </Form>
      </Modal>
      
      {/* เพิ่ม Modal สำหรับแก้ไขกลุ่ม */}
      <Modal
        title="แก้ไขกลุ่ม"
        open={groupEditorVisible}
        onOk={saveGroupChanges}
        onCancel={() => setGroupEditorVisible(false)}
        width={800}
        okText="บันทึก"
        cancelText="ยกเลิก"
      >
        <Tabs defaultActiveKey="properties">
          <Tabs.TabPane tab="คุณสมบัติกลุ่ม" key="properties">
            <Form layout="vertical">
              <Form.Item label="ชื่อกลุ่ม">
                <Input 
                  value={editingGroupName} 
                  onChange={(e) => setEditingGroupName(e.target.value)}
                  placeholder="ใส่ชื่อกลุ่ม"
                />
              </Form.Item>
              <Form.Item label="จำนวนรอบการทำซ้ำ">
                <InputNumber 
                  min={1} 
                  max={100} 
                  value={editingGroupLoopCount} 
                  onChange={(value) => setEditingGroupLoopCount(value || 1)}
                  style={{ width: '150px' }}
                  addonAfter="รอบ"
                />
              </Form.Item>
            </Form>
          </Tabs.TabPane>
          
          <Tabs.TabPane tab="ขั้นตอนในกลุ่ม" key="steps">
            <div className="group-steps mb-4">
              <h4>ขั้นตอนในกลุ่ม ({editingGroupSteps.length})</h4>
              {editingGroupSteps.length > 0 ? (
                <Table 
                  dataSource={editingGroupSteps}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  columns={[
                    {
                      title: '#',
                      key: 'index',
                      width: 60,
                      render: (text, record, index) => index + 1
                    },
                    {
                      title: 'ขั้นตอน',
                      dataIndex: 'type',
                      key: 'type',
                      render: (type, record) => (
                        <Space>
                          {getStepIcon(type)}
                          <span>{getStepDescription(record)}</span>
                        </Space>
                      )
                    },
                    {
                      title: 'จัดการ',
                      key: 'action',
                      width: 150,
                      render: (text, record, index) => (
                        <Space>
                          <Button 
                            icon={<ArrowUpOutlined />} 
                            size="small"
                            disabled={index === 0}
                            onClick={() => moveStepUp(record.id)}
                          />
                          <Button 
                            icon={<ArrowDownOutlined />} 
                            size="small"
                            disabled={index === editingGroupSteps.length - 1}
                            onClick={() => moveStepDown(record.id)}
                          />
                          <Button 
                            icon={<DeleteOutlined />} 
                            size="small"
                            danger
                            onClick={() => removeStepFromEditingGroup(record.id)}
                          />
                        </Space>
                      )
                    }
                  ]}
                />
              ) : (
                <div className="text-center p-4 bg-gray-50 rounded">
                  <p>ไม่มีขั้นตอนในกลุ่ม</p>
                </div>
              )}
            </div>
            
            <div className="available-steps">
              <h4>ขั้นตอนที่สามารถเพิ่มได้ ({availableSteps.length})</h4>
              {availableSteps.length > 0 ? (
                <Table 
                  dataSource={availableSteps}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  columns={[
                    {
                      title: '#',
                      key: 'index',
                      width: 60,
                      render: (text, record, index) => index + 1
                    },
                    {
                      title: 'ขั้นตอน',
                      dataIndex: 'type',
                      key: 'type',
                      render: (type, record) => (
                        <Space>
                          {getStepIcon(type)}
                          <span>{getStepDescription(record)}</span>
                        </Space>
                      )
                    },
                    {
                      title: 'จัดการ',
                      key: 'action',
                      width: 100,
                      render: (text, record) => (
                        <Button 
                          icon={<PlusOutlined />} 
                          size="small"
                          onClick={() => addStepToEditingGroup(record.id)}
                        >
                          เพิ่ม
                        </Button>
                      )
                    }
                  ]}
                />
              ) : (
                <div className="text-center p-4 bg-gray-50 rounded">
                  <p>ไม่มีขั้นตอนที่สามารถเพิ่มได้</p>
                </div>
              )}
            </div>
          </Tabs.TabPane>
        </Tabs>
      </Modal>
      
      {/* Hidden file input for loading steps from file */}
      <input 
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".json"
        style={{ display: 'none' }}
      />
    </Card>
  );
};

export default StepsList; 