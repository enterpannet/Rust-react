import React from 'react';
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
        <p className="mb-4">
          {isRecording
            ? "กำลังบันทึกการทำงานอัตโนมัติ..."
            : "เริ่มบันทึกเพื่อจับการเคลื่อนไหวเมาส์ การคลิก และการกดปุ่มบนแป้นพิมพ์"}
        </p>
        
        <Button
          type={isRecording ? "default" : "primary"}
          danger={isRecording}
          icon={isRecording ? <AudioMutedOutlined /> : <AudioOutlined />}
          onClick={handleToggleRecording}
          disabled={!isConnected}
          size="large"
          className="w-full"
        >
          {isRecording ? "หยุดบันทึก" : "เริ่มบันทึก"}
        </Button>
        
        {!isConnected && (
          <p className="text-red-500 text-sm mt-2">
            กรุณาเชื่อมต่อกับเซิร์ฟเวอร์เพื่อเริ่มการบันทึก
          </p>
        )}
      </div>

      {isRecording ? (
        <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
          <h4 className="font-bold text-left mb-2">กำลังบันทึกอัตโนมัติ:</h4>
          <List
            size="small"
            itemLayout="horizontal"
            dataSource={[
              {
                icon: <AimOutlined />,
                title: 'การเคลื่อนไหวเมาส์',
                description: 'บันทึกตำแหน่ง X, Y ของเมาส์เมื่อมีการเคลื่อนที่'
              },
              {
                icon: <AimOutlined />,
                title: 'การคลิกเมาส์',
                description: 'บันทึกการคลิกปุ่มซ้าย ขวา และกลางของเมาส์'
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
        <div className="mt-4 text-gray-500 text-sm">
          <p className="text-left">
            การบันทึกจะจับเหตุการณ์ต่อไปนี้โดยอัตโนมัติ:
          </p>
          <ul className="list-disc pl-5 text-left">
            <li>การเคลื่อนไหวของเมาส์ (ตำแหน่ง X, Y)</li>
            <li>การคลิกปุ่มซ้าย/ขวา/กลาง ของเมาส์</li>
            <li>การกดปุ่มต่างๆ บนแป้นพิมพ์</li>
          </ul>
        </div>
      )}
    </Card>
  );
};

export default RecordingPanel; 