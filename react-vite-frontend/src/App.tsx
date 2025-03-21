import { useState, useEffect, useRef } from 'react';
import { Layout, Typography, Row, Col, notification, Card, Space, Badge, InputNumber, Button } from 'antd';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { CloseCircleTwoTone, CheckCircleTwoTone } from '@ant-design/icons';

import { MousePosition, Step, SocketType } from './types';
import StatusBar from './components/StatusBar';
import ControlPanel from './components/ControlPanel';
import RecordingPanel from './components/RecordingPanel';
import MousePositionDisplay from './components/MousePositionDisplay';
import WaitTimePanel from './components/WaitTimePanel';
import RandomTimingPanel from './components/RandomTimingPanel';
import StepsList from './components/StepsList';
import MouseClickButtons from './components/MouseClickButtons';
import ProgressPanel from './components/ProgressPanel';

const { Header, Content } = Layout;
const { Title } = Typography;

function App() {
  // WebSocket connection state
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  // Automation and recording states
  const [isRunning, setIsRunning] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [completedSteps, setCompletedSteps] = useState<number>(0);
  const [totalSteps, setTotalSteps] = useState<number>(0);

  // Steps and other details
  const [steps, setSteps] = useState<Step[]>([]);
  const [mousePosition, setMousePosition] = useState<MousePosition>({ x: 0, y: 0 });
  const [waitTime, setWaitTime] = useState(1);
  const [loopCount, setLoopCount] = useState<number>(1);

  // Random timing state
  const [randomTimingEnabled, setRandomTimingEnabled] = useState(false);
  const [randomTimingMinFactor, setRandomTimingMinFactor] = useState(0.8);
  const [randomTimingMaxFactor, setRandomTimingMaxFactor] = useState(1.2);
  const [randomTiming, setRandomTiming] = useState({
    enabled: false,
    minFactor: 0.8,
    maxFactor: 1.2
  });

  // เพิ่ม state เก็บขั้นตอนที่เลือกและที่คัดลอก
  const [selectedSteps, setSelectedSteps] = useState<string[]>([]);
  const [copiedSteps, setCopiedSteps] = useState<Step[]>([]);

  // เพิ่ม state สำหรับจัดการข้อความแจ้งเตือน
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'info' | 'success' | 'error' | 'warning'>('info');

  // State สำหรับเก็บรายการที่เลือก
  const [selectedStepIds, setSelectedStepIds] = useState<string[]>([]);

  // Connect to WebSocket when component loads
  useEffect(() => {
    console.log("Attempting to connect to WebSocket server...");

    const connectWebSocket = () => {
      const socket = new WebSocket('ws://localhost:5000/ws');

      socket.onopen = () => {
        console.log("Connected to WebSocket server");
        setWsConnected(true);

        // Send initial requests after successful connection
        setTimeout(() => {
          try {
            console.log("Sending initial requests...");
            socket.send(JSON.stringify({ type: "get_steps" }));
            socket.send(JSON.stringify({ type: "get_random_timing" }));
          } catch (err) {
            console.error("Error sending initial requests:", err);
          }
        }, 500);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // console.log("Received WebSocket message:", data);

          if (data.type === "steps_updated") {
            setSteps(data.data.steps || []);
          } else if (data.type === "random_timing_updated") {
            setRandomTiming({
              enabled: data.data.enabled,
              minFactor: data.data.min_factor,
              maxFactor: data.data.max_factor
            });

            // Also update individual state variables
            setRandomTimingEnabled(data.data.enabled);
            setRandomTimingMinFactor(data.data.min_factor);
            setRandomTimingMaxFactor(data.data.max_factor);
          } else if (data.type === "status_update") {
            setIsRunning(data.data.status === 'running');
            setIsRecording(data.data.status === 'recording');
            setStatus(data.data.status || "idle");

            // Show toast message if present
            if (data.data.message) {
              showMessage(data.data.message, data.data.status === 'running' ? 'success' : data.data.status === 'recording' ? 'info' : 'error');
            }
          } else if (data.type === "step_executing") {
            setCurrentStep(data.data.index);
            // เพิ่มการอัปเดตขั้นตอนที่สำเร็จ
            if (data.data.index > 0) {
              setCompletedSteps(data.data.index);
            }
            // เพิ่มการอัปเดตจำนวนขั้นตอนทั้งหมด
            if (data.data.total_steps) {
              setTotalSteps(data.data.total_steps);
            }
          } else if (data.type === "mouse_position") {
            // Only update if the position is not 0,0 and different from current
            if (data.data.x !== 0 || data.data.y !== 0) {
              setMousePosition(data.data);
            }
          } else if (data.type === "automation_completed") {
            setIsRunning(false);
            setCurrentStep(null);
            // รีเซ็ตค่าเมื่อทำงานเสร็จ
            setCompletedSteps(0);
            setTotalSteps(0);
            showMessage('Automation completed!', 'success');
          }
        } catch (err) {
          console.error("Error processing WebSocket message:", err);
        }
      };

      socket.onclose = (event) => {
        console.log(`Disconnected from WebSocket server: Code: ${event.code}, Reason: ${event.reason}`);
        setWsConnected(false);

        // Try to reconnect after delay
        setTimeout(() => {
          console.log("Attempting to reconnect...");
          connectWebSocket();
        }, 3000);
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      setWs(socket);
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  // สร้างฟังก์ชันสำหรับแสดงข้อความแจ้งเตือน
  const showMessage = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setStatusMessage(message);
    setMessageType(type);
  };

  // Function to add a step
  const addStep = (stepType: string, data: Record<string, any> = {}) => {
    // Add wait_time and randomize to step
    const stepData = {
      ...data,
      wait_time: waitTime,
      randomize: randomTimingEnabled,
      step_type: data.step_type || stepType // Ensure step_type is included
    };

    if (ws && ws instanceof WebSocket) {
      // Send to backend if connected
      ws.send(JSON.stringify({
        type: 'add_step',
        data: stepData
      }));
    } else {
      // Fallback: Add step locally if backend is not available
      const newStep: Step = {
        id: Date.now().toString(),
        type: stepType,
        data: stepData
      };

      setSteps(prevSteps => [...prevSteps, newStep]);
      showMessage('Step added', 'success');
    }
  };

  // Add keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F6') {
        // Call the same function as the "Add Mouse Move To This Position" button
        addStep('mouse_move', { x: mousePosition.x, y: mousePosition.y, step_type: 'mouse_move' });

        // Show confirmation toast
        showMessage(`Mouse position (${mousePosition.x}, ${mousePosition.y}) captured`, 'info');
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Clean up event listener on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mousePosition, addStep, waitTime, randomTimingEnabled]);

  // Function to clear steps list
  const clearSteps = () => {
    if (ws && ws instanceof WebSocket) {
      ws.send(JSON.stringify({
        type: 'clear_steps'
      }));
    } else {
      // Fallback: Clear steps locally if backend is not available
      setSteps([]);
      showMessage('All steps cleared', 'info');
    }
  };

  // Function to delete selected steps
  const deleteSelectedSteps = (stepIds: string[]) => {
    if (ws && ws instanceof WebSocket) {
      ws.send(JSON.stringify({
        type: 'delete_steps',
        data: { step_ids: stepIds }
      }));
    } else {
      // Fallback: Delete steps locally if backend is not available
      const updatedSteps = steps.filter(step => !stepIds.includes(step.id));
      setSteps(updatedSteps);
      showMessage(`${stepIds.length} steps deleted`, 'info');
    }
  };

  // Function to run automation
  const runAutomation = () => {
    if (ws && wsConnected && steps.length > 0) {
      // สร้างรายการขั้นตอนที่จะรัน โดยคลี่กลุ่มออกมา
      let processedSteps: Step[] = [];
      
      // วนลูปผ่านทุกขั้นตอน
      steps.forEach(step => {
        // ถ้าเป็นขั้นตอนปกติ ให้เพิ่มเข้าไปตามปกติ
        if (step.type !== 'group') {
          processedSteps.push(step);
        } 
        // ถ้าเป็นกลุ่ม ให้เพิ่มขั้นตอนในกลุ่มเข้าไปตามจำนวนรอบที่กำหนด
        else if (step.type === 'group') {
          const groupSteps = step.data.groupSteps || [];
          const loopCount = step.data.groupLoopCount || 1;
          
          // ทำซ้ำตามจำนวนรอบ
          for (let i = 0; i < loopCount; i++) {
            // เพิ่มทุกขั้นตอนในกลุ่ม
            processedSteps.push(...groupSteps);
          }
        }
      });
      
      if (processedSteps.length > 0) {
        ws.send(JSON.stringify({
          type: "run_automation",
          data: { 
            loop_count: loopCount,
            steps: processedSteps  // ส่งรายการ steps ที่คลี่กลุ่มแล้ว (ทั้ง object ไม่ใช่แค่ id)
          }
        }));
      }
    } else {
      showMessage("Cannot run automation: WebSocket not connected or no steps defined", 'error');
    }
  };

  // Function to stop automation
  const stopAutomation = () => {
    if (ws && wsConnected) {
      ws.send(JSON.stringify({ type: "stop_automation" }));
    } else {
      showMessage("WebSocket disconnected. Cannot stop automation.", 'error');
    }
  };

  // Function to toggle recording
  const toggleRecording = () => {
    if (ws && wsConnected) {
      if (!isRecording) {
        // Start recording - ONLY send the recording command, nothing else
        console.log("Starting recording - No other actions should trigger");
        ws.send(JSON.stringify({ type: "start_recording" }));
      } else {
        // Stop recording - ONLY send the stop recording command
        console.log("Stopping recording - No other actions should trigger");
        ws.send(JSON.stringify({ type: "stop_recording" }));
      }
    } else {
      showMessage("WebSocket disconnected. Cannot toggle recording.", 'error');
    }
  };

  // Function to run selected steps
  const runSelectedSteps = (selectedIds: string[]) => {
    if (ws && wsConnected && selectedIds.length > 0) {
      console.log('Running selected steps:', selectedIds);
      
      // สร้างรายการขั้นตอนที่จะรัน โดยคลี่กลุ่มออกมา
      let processedSteps: Step[] = [];
      
      selectedIds.forEach(stepId => {
        const step = steps.find(s => s.id === stepId);
        
        // ถ้าเป็นขั้นตอนปกติ ให้เพิ่มเข้าไปตามปกติ
        if (step && step.type !== 'group') {
          processedSteps.push(step);
        } 
        // ถ้าเป็นกลุ่ม ให้เพิ่มขั้นตอนในกลุ่มเข้าไปตามจำนวนรอบที่กำหนด
        else if (step && step.type === 'group') {
          const groupSteps = step.data.groupSteps || [];
          const loopCount = step.data.groupLoopCount || 1;
          
          // ทำซ้ำตามจำนวนรอบ
          for (let i = 0; i < loopCount; i++) {
            // เพิ่มทุกขั้นตอนในกลุ่ม
            processedSteps.push(...groupSteps);
          }
        }
      });
      
      if (processedSteps.length > 0) {
        ws.send(JSON.stringify({
          type: 'run_selected_steps',
          data: { steps: processedSteps }
        }));
      }
    } else {
      showMessage('Cannot run selected steps: WebSocket not connected or no steps selected', 'error');
    }
  };

  // Function to update random timing settings
  const updateRandomTiming = (enabled: boolean, minFactor: number, maxFactor: number) => {
    if (ws && wsConnected) {
      ws.send(JSON.stringify({
        type: 'update_random_timing',
        data: {
          enabled,
          min_factor: minFactor,
          max_factor: maxFactor
        }
      }));
    }

    // Update local state
    setRandomTiming({
      enabled,
      minFactor,
      maxFactor
    });

    // Also update individual state variables
    setRandomTimingEnabled(enabled);
    setRandomTimingMinFactor(minFactor);
    setRandomTimingMaxFactor(maxFactor);
  };

  // ใน App.tsx เพิ่มฟังก์ชัน reorderSteps
  const reorderSteps = (newOrderedSteps: Step[]) => {
    // อัพเดทสถานะภายใน
    setSteps(newOrderedSteps);

    // ส่งข้อมูลการเรียงลำดับใหม่ไปยัง backend ถ้า WebSocket เชื่อมต่ออยู่
    if (ws && ws instanceof WebSocket) {
      ws.send(JSON.stringify({
        type: 'update_steps_order',
        data: { steps: newOrderedSteps }
      }));
    }
  };

  // ฟังก์ชันสำหรับจัดการการคัดลอกขั้นตอน
  const handleCopySelectedSteps = (stepsToCopy: Step[]) => {
    setCopiedSteps(stepsToCopy);
    showMessage(`คัดลอก ${stepsToCopy.length} ขั้นตอน`, 'info');
  };

  // ฟังก์ชันสำหรับวางขั้นตอนที่คัดลอก
  const handlePasteSteps = (stepsToPaste: Step[], afterStepId?: string) => {
    if (stepsToPaste.length > 0) {
      // สร้าง id ใหม่สำหรับ steps ที่จะวาง
      const newPastedSteps = stepsToPaste.map(step => ({
        ...step,
        id: Date.now() + Math.random().toString(36).substring(2, 9)
      }));
      
      if (ws && ws instanceof WebSocket) {
        if (afterStepId) {
          // หาตำแหน่งของ afterStepId
          const targetIndex = steps.findIndex(step => step.id === afterStepId);
          if (targetIndex !== -1) {
            // สร้างรายการขั้นตอนใหม่ โดยแทรกหลังตำแหน่งที่ระบุ
            const newSteps = [
              ...steps.slice(0, targetIndex + 1),
              ...newPastedSteps,
              ...steps.slice(targetIndex + 1)
            ];
            
            // ส่งรายการใหม่ทั้งหมดไปยัง backend
            ws.send(JSON.stringify({
              type: 'update_steps_order',
              data: { steps: newSteps }
            }));
            
            return; // ออกจากฟังก์ชันเมื่อดำเนินการเสร็จแล้ว
          }
        }
        
        // กรณีไม่ระบุตำแหน่งหรือหาตำแหน่งไม่เจอ ให้วางต่อท้ายรายการ
        newPastedSteps.forEach(step => {
          ws.send(JSON.stringify({
            type: 'add_step',
            data: step.data
          }));
        });
      }
    }
  };

  // ฟังก์ชันรับข้อมูลการเลือกจาก StepsList
  const handleStepsSelection = (selectedIds: string[]) => {
    setSelectedStepIds(selectedIds);
    console.log('Selected steps:', selectedIds); // สำหรับ debug
  };

  // เพิ่มฟังก์ชันใหม่สำหรับเพิ่ม wait step ระหว่างกลางของ item ที่เลือก
  const handleAddWaitBetweenSelected = (waitTime: number) => {
    if (selectedStepIds.length < 2) return;
    
    console.log('handleAddWaitBetweenSelected called with waitTime:', waitTime);
    console.log('selectedStepIds:', selectedStepIds);
    
    // เรียงลำดับ selectedSteps ตามตำแหน่งใน steps
    const sortedSelectedIndexes = selectedStepIds
      .map(id => steps.findIndex(step => step.id === id))
      .sort((a, b) => a - b);
    
    console.log('sortedSelectedIndexes:', sortedSelectedIndexes);
    
    // สร้าง steps ใหม่โดยแทรก wait steps ระหว่าง selected steps
    const newSteps = [...steps];
    let offset = 0;
    
    for (let i = 1; i < sortedSelectedIndexes.length; i++) {
      const insertPosition = sortedSelectedIndexes[i-1] + 1 + offset;
      
      console.log('Inserting wait step at position:', insertPosition);
      
      // สร้าง wait step ใหม่
      const newWaitStep: Step = {
        id: Date.now() + Math.random().toString(36).substring(2, 9) + i,
        type: 'wait',
        data: { 
          wait_time: waitTime,
          randomize: randomTimingEnabled
        }
      };
      
      // แทรก wait step เข้าไปในตำแหน่งที่ต้องการ
      newSteps.splice(insertPosition, 0, newWaitStep);
      offset++; // เพิ่ม offset เนื่องจากเราได้เพิ่ม step ใหม่เข้าไป
    }
    
    console.log('New steps array:', newSteps);
    
    // ส่ง steps ใหม่ไปยัง backend
    if (ws && ws instanceof WebSocket) {
      ws.send(JSON.stringify({
        type: 'update_steps_order',
        data: { steps: newSteps }
      }));
    } else {
      // ถ้าไม่มีการเชื่อมต่อกับ backend ให้อัพเดต steps โดยตรง
      setSteps(newSteps);
      showMessage('Added wait steps between selected items', 'success');
    }
  };

  useEffect(() => {
    // ป้องกันการคลิกขวา
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };
    
    document.addEventListener('contextmenu', handleContextMenu);
    
    // ทำความสะอาดเมื่อคอมโพเนนต์ถูกทำลาย
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <Layout className="w-[1040px] h-[800px] overflow-hidden shadow-lg relative">
        <div className="absolute top-0 left-0 right-0 z-10 bg-white border-b h-14">
          <div className="flex items-center px-4 h-full">
            <Title level={4} className="m-0 text-blue-800">ระบบบันทึกการทำงานอัตโนมัติ</Title>
          </div>
        </div>

        <Content className="p-3 pt-16 pb-12 h-full overflow-auto">
          <Row gutter={[12, 12]} className="h-full">
            <Col span={8}>
              <div className="flex flex-col gap-3">
                <RecordingPanel
                  isRecording={isRecording}
                  isConnected={wsConnected}
                  onStartRecording={() => toggleRecording()}
                  onStopRecording={() => toggleRecording()}
                />

                <WaitTimePanel
                  isConnected={wsConnected}
                  waitTime={waitTime}
                  onWaitTimeChange={setWaitTime}
                  onAddWaitTime={addStep}
                  selectedSteps={selectedStepIds}
                  onAddWaitBetweenSelected={handleAddWaitBetweenSelected}
                />

               
              </div>
            </Col>

            <Col span={8}>
              <div className="flex flex-col gap-1">
                <div className="flex-1 min-h-0">
                  <StepsList
                    steps={steps}
                    currentStep={currentStep}
                    onRunSelectedSteps={runSelectedSteps}
                    onReorderSteps={reorderSteps}
                    onClearAllSteps={clearSteps}
                    onDeleteSelectedSteps={deleteSelectedSteps}
                    onCopySelectedSteps={handleCopySelectedSteps}
                    onPasteSteps={handlePasteSteps}
                    onStepsSelection={handleStepsSelection}
                  />
                </div>
                
                <ControlPanel
                  status={status}
                  isRunning={isRunning}
                  steps={steps}
                  loopCount={loopCount}
                  setLoopCount={setLoopCount}
                  onRunAutomation={runAutomation}
                  onStopAutomation={stopAutomation}
                />
              </div>
            </Col>
            <Col span={8}>
              <div className="flex flex-col gap-3">
                <MouseClickButtons 
                  isConnected={Boolean(ws)} 
                  onAddStep={addStep} 
                  mousePosition={mousePosition}
                  ws={ws}
                />

                <ProgressPanel
                  steps={steps}
                  currentStep={currentStep}
                  isRunning={isRunning}
                  status={status}
                  completedSteps={completedSteps}
                  totalSteps={totalSteps}
                />
              </div>
            </Col>
          </Row>
        </Content>

        <div className="absolute bottom-0 left-0 right-0 z-10 bg-white border-t h-10">
          <StatusBar
            isConnected={wsConnected}
            mousePosition={mousePosition}
            message={statusMessage}
            messageType={messageType}
          />
        </div>
      </Layout>
    </div>
  );
}

export default App;
