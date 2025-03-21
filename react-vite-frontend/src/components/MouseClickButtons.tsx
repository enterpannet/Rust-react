import React, { useState, useEffect } from 'react';
import { Button, Card, Input, Select, Space, Divider, Checkbox, Tooltip, Modal, Form, Row, Col, Typography } from 'antd';
import { toast } from 'react-toastify';
import { MousePosition } from '../types';
import { CopyOutlined, ScissorOutlined, PlusOutlined, EditOutlined, DeleteOutlined, ImportOutlined, ExportOutlined } from '@ant-design/icons';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

// กำหนดโครงสร้างข้อมูลสำหรับ shortcut
interface Shortcut {
  id: string;
  name: string;
  key: string;
  modifiers: string[];
  description: string;
}

interface MouseClickButtonsProps {
  isConnected: boolean;
  mousePosition: MousePosition;
  ws: WebSocket | null;
  onAddStep?: (stepType: string, data: Record<string, any>) => void;
}

const MouseClickButtons: React.FC<MouseClickButtonsProps> = ({ 
  isConnected, 
  mousePosition, 
  onAddStep,
  ws
}) => {
  const [keyInput, setKeyInput] = useState<string>('');
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [useCtrl, setUseCtrl] = useState<boolean>(false);
  const [useAlt, setUseAlt] = useState<boolean>(false);
  const [useShift, setUseShift] = useState<boolean>(false);
  
  // shortcuts state
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([
    { id: '1', name: 'Copy', key: 'c', modifiers: ['ctrl'], description: 'คัดลอกข้อความ (Ctrl+C)' },
    { id: '2', name: 'Paste', key: 'v', modifiers: ['ctrl'], description: 'วางข้อความ (Ctrl+V)' },
    { id: '3', name: 'Select All', key: 'a', modifiers: ['ctrl'], description: 'เลือกทั้งหมด (Ctrl+A)' },
    { id: '4', name: 'Cut', key: 'x', modifiers: ['ctrl'], description: 'ตัด (Ctrl+X)' },
  ]);
  
  // modal state
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [editingShortcut, setEditingShortcut] = useState<Shortcut | null>(null);
  const [form] = Form.useForm();

  // Common keys preset
  const commonKeys = [
    { label: 'Enter', value: 'enter' },
    { label: 'Tab', value: 'tab' },
    { label: 'Space', value: 'space' },
    { label: 'Backspace', value: 'backspace' },
    { label: 'Escape', value: 'escape' },
    { label: 'Delete', value: 'delete' },
    { label: 'Arrow Up', value: 'up' },
    { label: 'Arrow Down', value: 'down' },
    { label: 'Arrow Left', value: 'left' },
    { label: 'Arrow Right', value: 'right' },
    { label: 'F5', value: 'f5' },
    { label: 'F6', value: 'f6' },
    { label: 'F7', value: 'f7' },
    { label: 'F8', value: 'f8' },
    { label: 'F9', value: 'f9' },
    { label: 'F10', value: 'f10' },
    { label: 'F11', value: 'f11' },
    { label: 'F12', value: 'f12' },
  ];

  const addMouseClickStep = (button: 'left' | 'right' | 'middle') => {
    if (onAddStep) {
      onAddStep('mouse_click', {
        button: button,
        x: mousePosition.x,
        y: mousePosition.y,
        step_type: 'mouse_click'
      });
      toast.success(`เพิ่มขั้นตอนคลิกเมาส์${button === 'left' ? 'ซ้าย' : button === 'right' ? 'ขวา' : 'กลาง'} ที่ตำแหน่ง (${mousePosition.x}, ${mousePosition.y}) แล้ว`);
    }
  };

  // ฟังก์ชันใหม่สำหรับเพิ่มขั้นตอนการกดคีย์
  const addKeyPressStep = () => {
    const keyToPress = selectedKey || keyInput;
    
    if (onAddStep && keyToPress) {
      // เปลี่ยนวิธีการสร้าง keyCombo
      const modifiers = [];
      if (useCtrl) modifiers.push("ctrl");
      if (useAlt) modifiers.push("alt");
      if (useShift) modifiers.push("shift");
      
      onAddStep('key_press', {
        key: keyToPress,
        modifiers: modifiers, // ส่ง modifiers แยก
        step_type: 'key_press'
      });
      
      // แสดงผลยังคงเป็นรูปแบบเดิม
      const displayCombo = [...modifiers, keyToPress].join('+');
      toast.success(`เพิ่มขั้นตอนกดคีย์ '${displayCombo}' แล้ว`);
      
      // เคลียร์ input
      setKeyInput('');
      setSelectedKey('');
      setUseCtrl(false);
      setUseAlt(false);
      setUseShift(false);
    } else {
      toast.error('กรุณาระบุคีย์ที่ต้องการกด');
    }
  };

  // เพิ่มฟังก์ชันใหม่สำหรับ Hotkeys
  const addHotkeySequence = (key: string) => {
    if (!onAddStep) return;
    
    // 1. กดปุ่ม Ctrl ลง
    onAddStep('key_press', {
      key: 'ctrl',
      action: 'down',
      step_type: 'key_press',
      wait_time: 0.1
    });
    
    // 2. กดปุ่มตัวอักษร
    onAddStep('key_press', {
      key: key,
      action: 'press',
      step_type: 'key_press',
      wait_time: 0.1
    });
    
    // 3. ปล่อยปุ่ม Ctrl
    onAddStep('key_press', {
      key: 'ctrl',
      action: 'up',
      step_type: 'key_press',
      wait_time: 0.1
    });
    
    toast.success(`เพิ่มชุดคำสั่ง Ctrl+${key.toUpperCase()} แล้ว`);
  };

  // ฟังก์ชันสำหรับการ execute shortcut โดยตรง (ไม่เพิ่มเป็น step)
  const performShortcut = (shortcut: Shortcut) => {
    if (!isConnected) {
      toast.error('กรุณาเชื่อมต่อกับ backend ก่อน');
      return;
    }
    
    if (ws && ws instanceof WebSocket) {
      // การรวม modifiers และ key ให้เป็น command
      if (shortcut.name === 'Copy') {
        ws.send(JSON.stringify({
          command: "perform_copy"
        }));
        toast.info('ส่งคำสั่ง Copy (Ctrl+C) ไปยัง backend');
      } else if (shortcut.name === 'Paste') {
        ws.send(JSON.stringify({
          command: "perform_paste"
        }));
        toast.info('ส่งคำสั่ง Paste (Ctrl+V) ไปยัง backend');
      } else if (shortcut.name === 'Select All') {
        ws.send(JSON.stringify({
          command: "perform_select_all"
        }));
        toast.info('ส่งคำสั่ง Select All (Ctrl+A) ไปยัง backend');
      } else {
        // สำหรับ shortcuts อื่นๆ ที่ยังไม่มีคำสั่งเฉพาะ
        const keyCombo = [...shortcut.modifiers, shortcut.key].join('+');
        ws.send(JSON.stringify({
          command: "key_press",
          key: keyCombo
        }));
        toast.info(`ส่งคำสั่ง ${shortcut.name} (${keyCombo}) ไปยัง backend`);
      }
    } else {
      toast.error('WebSocket ไม่ได้เชื่อมต่อ');
    }
  };
  
  // เพิ่มฟังก์ชันสำหรับเพิ่มขั้นตอน Shortcut ลงใน list
  const addShortcutStep = (shortcut: Shortcut) => {
    if (onAddStep) {
      const keyCombo = [...shortcut.modifiers, shortcut.key].join('+');
      onAddStep('key_press', {
        key: keyCombo,
        is_shortcut: true,
        step_type: 'key_press'
      });
      toast.success(`เพิ่มขั้นตอน ${shortcut.name} (${keyCombo}) แล้ว`);
    }
  };

  // ฟังก์ชันสำหรับเปิด Modal เพื่อสร้าง/แก้ไข shortcut
  const showModal = (shortcut?: Shortcut) => {
    setEditingShortcut(shortcut || null);
    
    if (shortcut) {
      form.setFieldsValue({
        name: shortcut.name,
        key: shortcut.key,
        modifiers: shortcut.modifiers,
        description: shortcut.description
      });
    } else {
      form.resetFields();
    }
    
    setIsModalVisible(true);
  };

  // ฟังก์ชันสำหรับการบันทึก shortcut
  const handleSaveShortcut = () => {
    form.validateFields().then(values => {
      const newShortcut: Shortcut = {
        id: editingShortcut ? editingShortcut.id : Date.now().toString(),
        name: values.name,
        key: values.key,
        modifiers: values.modifiers || [],
        description: values.description
      };
      
      if (editingShortcut) {
        // update existing shortcut
        setShortcuts(shortcuts.map(s => (s.id === editingShortcut.id ? newShortcut : s)));
      } else {
        // add new shortcut
        setShortcuts([...shortcuts, newShortcut]);
      }
      
      setIsModalVisible(false);
      toast.success(`${editingShortcut ? 'อัพเดท' : 'เพิ่ม'} shortcut "${newShortcut.name}" เรียบร้อยแล้ว`);
    });
  };

  // ฟังก์ชันสำหรับลบ shortcut
  const deleteShortcut = (id: string) => {
    setShortcuts(shortcuts.filter(s => s.id !== id));
    toast.success('ลบ shortcut เรียบร้อยแล้ว');
  };

  // เพิ่มข้อมูล state สำหรับคลิปบอร์ดและ modal
  const [clipboardText, setClipboardText] = useState<string>('');
  const [clipboardModalVisible, setClipboardModalVisible] = useState<boolean>(false);
  const [clipboardModalMode, setClipboardModalMode] = useState<'get' | 'set'>('get');

  // ฟังก์ชันสำหรับดึงข้อความจากคลิปบอร์ด
  const getClipboardText = () => {
    if (!isConnected || !ws) {
      toast.error('กรุณาเชื่อมต่อกับ backend ก่อน');
      return;
    }
    
    ws.send(JSON.stringify({
      command: "get_clipboard"
    }));
    
    // สร้าง event listener เพื่อรับข้อความคลิปบอร์ด
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'clipboard_text') {
          setClipboardText(data.text);
          setClipboardModalMode('get');
          setClipboardModalVisible(true);
          ws.removeEventListener('message', handleMessage);
        }
      } catch (err) {
        console.error('Error parsing clipboard response:', err);
      }
    };
    
    ws.addEventListener('message', handleMessage);
    toast.info('กำลังดึงข้อความจากคลิปบอร์ด...');
  };

  // ฟังก์ชันสำหรับกำหนดข้อความคลิปบอร์ด
  const showSetClipboardModal = () => {
    setClipboardText('');
    setClipboardModalMode('set');
    setClipboardModalVisible(true);
  };

  const updateClipboardText = (text: string) => {
    if (!isConnected || !ws) {
      toast.error('กรุณาเชื่อมต่อกับ backend ก่อน');
      return;
    }
    
    ws.send(JSON.stringify({
      command: "set_clipboard",
      text: text
    }));
    
    toast.info('กำหนดข้อความลงในคลิปบอร์ดแล้ว');
    setClipboardModalVisible(false);
  };

  return (
    <Card title="การควบคุมอุปกรณ์" className="w-full">
      <div className="flex flex-col gap-4">
        <div>        
          <h4 className=" font-medium">เมาส์</h4>
          <div className="flex flex-col justify-center gap-2">
            <Button 
              type="primary" 
              onClick={() => addMouseClickStep('left')}
              disabled={!isConnected || !onAddStep}
              className="bg-blue-500 text-white"
            >
              + คลิกซ้าย(F1)
            </Button>
            <Button 
              onClick={() => addMouseClickStep('middle')}
              disabled={!isConnected || !onAddStep}
              className="bg-blue-500 text-white"
            >
              + คลิกกลาง(F2)
            </Button>
            <Button 
              onClick={() => addMouseClickStep('right')}
              disabled={!isConnected || !onAddStep}
              className="bg-blue-500 text-white"
            >
              + คลิกขวา(F3)
            </Button>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center">
            <h4 className="font-medium">คีย์ลัด (Shortcuts)</h4>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              size="small" 
              onClick={() => showModal()}
            >
              เพิ่ม
            </Button>
          </div>
          
          <div className="flex flex-col gap-2 mt-2">
            {shortcuts.map(shortcut => (
              <div key={shortcut.id} className="flex items-center gap-2">
                <Tooltip title={shortcut.description}>
                  <Button
                    onClick={() => performShortcut(shortcut)}
                    disabled={!isConnected}
                    className="flex-1 text-left"
                    icon={shortcut.name === 'Copy' ? <CopyOutlined /> : undefined}
                  >
                    {shortcut.name}
                  </Button>
                </Tooltip>
                <Button 
                  onClick={() => addShortcutStep(shortcut)}
                  disabled={!isConnected || !onAddStep}
                >
                  +
                </Button>
                <Button
                  icon={<EditOutlined />}
                  size="small"
                  onClick={() => showModal(shortcut)}
                />
                <Button
                  icon={<DeleteOutlined />}
                  size="small"
                  danger
                  onClick={() => deleteShortcut(shortcut.id)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* <div>
          <h4 className="font-medium">คลิปบอร์ด</h4>
          <div className="flex flex-col gap-2 mt-2">
            <Button
              icon={<ImportOutlined />}
              onClick={getClipboardText}
              disabled={!isConnected}
              className="flex-1"
            >
              ดึงข้อความจากคลิปบอร์ด
            </Button>
            <Button
              icon={<ExportOutlined />}
              onClick={showSetClipboardModal}
              disabled={!isConnected}
              className="flex-1"
            >
              กำหนดข้อความลงคลิปบอร์ด
            </Button>
          </div>
        </div> */}

        <div>
          <h4 className=" font-medium">คีย์บอร์ด</h4>
          
          
          
          <div className="flex gap-2">
            <Input 
              placeholder="ระบุคีย์ที่ต้องการกด" 
              value={keyInput} 
              onChange={(e) => {
                setKeyInput(e.target.value);
                setSelectedKey(''); // เคลียร์ dropdown เมื่อพิมพ์
              }}
              disabled={!!selectedKey}
            />
            <Button 
              type="primary" 
              onClick={addKeyPressStep}
              disabled={!isConnected || !onAddStep || (!keyInput && !selectedKey)}
            >
              เพิ่มคีย์
            </Button>
          </div>
        </div>
      </div>

      {/* Modal สำหรับเพิ่ม/แก้ไข Shortcut */}
      <Modal
        title={`${editingShortcut ? 'แก้ไข' : 'เพิ่ม'} Shortcut`}
        open={isModalVisible}
        onOk={handleSaveShortcut}
        onCancel={() => setIsModalVisible(false)}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="ชื่อ"
            rules={[{ required: true, message: 'กรุณาระบุชื่อ Shortcut' }]}
          >
            <Input placeholder="เช่น Copy, Save, Print" />
          </Form.Item>
          
          <Form.Item
            name="key"
            label="คีย์หลัก"
            rules={[{ required: true, message: 'กรุณาระบุคีย์หลัก' }]}
          >
            <Input placeholder="เช่น c, v, a" />
          </Form.Item>
          
          <Form.Item
            name="modifiers"
            label="Modifier keys"
          >
            <Select 
              mode="multiple" 
              placeholder="เลือก modifier keys" 
              options={[
                { label: 'Ctrl', value: 'ctrl' },
                { label: 'Alt', value: 'alt' },
                { label: 'Shift', value: 'shift' }
              ]}
            />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="คำอธิบาย"
          >
            <Input placeholder="คำอธิบายเพิ่มเติม" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal สำหรับคลิปบอร์ด */}
      <Modal
        title={clipboardModalMode === 'get' ? 'ข้อความในคลิปบอร์ด' : 'กำหนดข้อความลงคลิปบอร์ด'}
        open={clipboardModalVisible}
        onCancel={() => setClipboardModalVisible(false)}
        footer={
          clipboardModalMode === 'get' 
          ? [
              <Button key="close" onClick={() => setClipboardModalVisible(false)}>
                ปิด
              </Button>
            ]
          : [
              <Button 
                key="cancel" 
                onClick={() => setClipboardModalVisible(false)}
              >
                ยกเลิก
              </Button>,
              <Button 
                key="submit" 
                type="primary" 
                onClick={() => updateClipboardText(clipboardText)}
              >
                กำหนดข้อความ
              </Button>
            ]
        }
      >
        {clipboardModalMode === 'get' ? (
          <div>
            <Text>ข้อความในคลิปบอร์ด:</Text>
            <div className="mt-2 p-2 border rounded bg-gray-50">
              <pre className="whitespace-pre-wrap break-words">{clipboardText || '(ไม่มีข้อความในคลิปบอร์ด)'}</pre>
            </div>
          </div>
        ) : (
          <div>
            <Text>กรอกข้อความที่ต้องการกำหนดลงคลิปบอร์ด:</Text>
            <TextArea
              rows={5}
              value={clipboardText}
              onChange={(e) => setClipboardText(e.target.value)}
              className="mt-2"
              placeholder="ข้อความที่ต้องการกำหนดลงคลิปบอร์ด"
            />
          </div>
        )}
      </Modal>
    </Card>
  );
};

export default MouseClickButtons; 