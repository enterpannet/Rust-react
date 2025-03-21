import React, { useEffect } from 'react';
import { Card, Button, Typography, Space, Badge, List } from 'antd';
import { AudioOutlined, AudioMutedOutlined, AimOutlined, KeyOutlined } from '@ant-design/icons';

const { Title } = Typography;

interface RecordingPanelProps {
  isRecording: boolean;
  isConnected: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

const RecordingPanel: React.FC<RecordingPanelProps> = ({ 
  isRecording, 
  isConnected, 
  onStartRecording, 
  onStopRecording 
}) => {
  
  const handleToggleRecording = () => {
    if (isRecording) {
      onStopRecording();
    } else {
      onStartRecording();
    }
  };
  
  // Add keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if F7 key is pressed (key code 118)
      if (event.key === 'F7' || event.keyCode === 118) {
        // Set a global flag to tell the recording system to ignore this F7 press
        // @ts-ignore - Adding property to window object
        window.__ignoreNextF7ForRecording = true;
        
        // Toggle recording state
        if (isRecording) {
          onStopRecording();
        } else {
          onStartRecording();
        }
        
        // Prevent default behavior (if any)
        event.preventDefault();
        
        // Clear the flag after a short delay
        setTimeout(() => {
          // @ts-ignore - Removing property from window object
          window.__ignoreNextF7ForRecording = false;
        }, 300);
      }
    };
    
    // Add the event listener to the window object for global access
    window.addEventListener('keydown', handleKeyDown);
    
    // Cleanup the event listener when component unmounts
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isRecording, onStartRecording, onStopRecording]); // Add dependencies
  
  return (
    <Card 
      title={
        <Space>
          <Title level={4} className="m-0">Recording</Title>
          {isRecording && <Badge status="processing" text="Recording" />}
        </Space>
      } 
      className="w-full h-full"
    >
      <div className="text-center mb-4">
        <p className="mb-4 h-11">
          {isRecording
            ? "กำลังบันทึกการทำงานอัตโนมัติ..."
            : "เริ่มบันทึกเพื่อจับการเคลื่อนไหวเมาส์ การคลิก และการกดปุ่มบนแป้นพิมพ์"}
        </p>
        
        <div className="flex items-center mb-2">
          <Button
            type={isRecording ? "default" : "primary"}
            danger={isRecording}
            icon={isRecording ? <AudioMutedOutlined /> : <AudioOutlined />}
            onClick={handleToggleRecording}
            disabled={!isConnected}
            size="large"
            className="w-full"
          >
            {isRecording ? "หยุดบันทึก " : "เริ่มบันทึก"}
          </Button>
          <span className="ml-3 text-sm text-gray-500">Shortcut: <kbd className="px-2 py-1 bg-gray-100 border rounded">F7</kbd></span>
        </div>
        
        {!isConnected && (
          <p className="text-red-500 text-sm mt-2">
            กรุณาเชื่อมต่อกับเซิร์ฟเวอร์เพื่อเริ่มการบันทึก
          </p>
        )}
      </div>

      {isRecording ? (
        <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200 overflow-y-auto h-[140px]">
          <h4 className="font-bold text-left mb-2">กำลังบันทึกอัตโนมัติ:</h4>
          <List
            size="small"
            itemLayout="horizontal"
            dataSource={[
              {
                icon: <AimOutlined />,
                title: 'ตำแหน่งและการคลิกเมาส์',
                description: 'บันทึกตำแหน่ง X, Y และการคลิกปุ่มซ้าย ขวา กลางของเมาส์เมื่อมีการคลิกเท่านั้น'
              },
              {
                icon: <KeyOutlined />,
                title: 'การกดแป้นพิมพ์',
                description: 'บันทึกการกดปุ่มบนแป้นพิมพ์ทั้งหมด'
              }
            ]}
            renderItem={item => (
              <List.Item>
                <List.Item.Meta
                  avatar={item.icon}
                  title={item.title}
                  description={item.description}
                />
              </List.Item>
            )}
          />
          <p className="text-xs text-gray-500 mt-3 text-left">
            * สามารถหยุดการบันทึกได้ทุกเมื่อโดยกดปุ่ม "หยุดบันทึก"
          </p>
        </div>
      ) : (
        <div className="mt-4 p-3 rounded border border-gray-200 text-gray-500 text-sm overflow-y-auto h-[140px]">
          <p className="text-left">
            การบันทึกจะจับเหตุการณ์ต่อไปนี้โดยอัตโนมัติ:
          </p>
          <ul className="list-disc pl-5 text-left">
            <li>ตำแหน่งเมาส์ (X, Y) เมื่อมีการคลิกเท่านั้น</li>
            <li>การคลิกปุ่มซ้าย/ขวา/กลาง ของเมาส์</li>
            <li>การกดปุ่มต่างๆ บนแป้นพิมพ์</li>
          </ul>
        </div>
      )}
    </Card>
  );
};

export default RecordingPanel; 