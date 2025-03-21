import React from 'react';
import { Card, Button, Typography, Statistic, Row, Col } from 'antd';
import { AimOutlined } from '@ant-design/icons';
import { MousePosition } from '../types';

const { Title } = Typography;

interface MousePositionDisplayProps {
  position: MousePosition;
  onAddMouseMove: (type: string, data: Record<string, any>) => void;
}


const MousePositionDisplay: React.FC<MousePositionDisplayProps> = ({ position, onAddMouseMove }) => {
  
  return (
    <Card title={<Title level={4}>Mouse Position</Title>} className="w-full h-full">
      <div className="mb-4">
        <Row gutter={16}>
          <Col span={12}>
            <Statistic
              title="X Coordinate"
              value={position.x}
              valueStyle={{ color: '#1677ff', fontSize: '24px' }}
              prefix={<AimOutlined />}
            />
          </Col>
          <Col span={12}>
            <Statistic
              title="Y Coordinate"
              value={position.y}
              valueStyle={{ color: '#1677ff', fontSize: '24px' }}
              prefix={<AimOutlined />}
            />
          </Col>
        </Row>
      </div>
      
      <div className="text-center">
        <Button
          type="primary"
          onClick={() => onAddMouseMove('mouse_move', { x: position.x, y: position.y, step_type: 'mouse_move' })}
          className="w-full"
        >
          Add Mouse Move To This Position
        </Button>
        <div className="mt-2 text-gray-500">
          กดปุ่ม F6 เพื่อเก็บตำแหน่งเมาส์ปัจจุบันได้อย่างรวดเร็ว
        </div>
      </div>
    </Card>
  );
};

export default MousePositionDisplay;
