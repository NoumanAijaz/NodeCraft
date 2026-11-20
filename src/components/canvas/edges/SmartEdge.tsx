import { memo } from 'react';
import {
  BaseEdge,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  useInternalNode,
  useReactFlow,
  Position,
  type EdgeProps,
} from '@xyflow/react';
import { getSmartEdgeRouting, projectPointToNodeBox } from '../../../utils/edgeRouting';
import { useDiagramStore, getAbsolutePosition } from '../../../store/useDiagramStore';

export const SmartEdge = memo(function SmartEdge(props: EdgeProps) {
  const {
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    sourceHandleId,
    targetHandleId,
    style,
    markerEnd,
    markerStart,
    label,
    labelStyle,
    labelShowBg,
    labelBgStyle,
    labelBgPadding,
    labelBgBorderRadius,
    interactionWidth,
    type = 'default',
    selected = false,
  } = props;

  const { screenToFlowPosition } = useReactFlow();

  // Attempt to read from internal node lookup
  const internalSource = useInternalNode(source);
  const internalTarget = useInternalNode(target);

  // Fallback to store if internalNode is not immediately available
  const storeNodes = useDiagramStore((s) => s.nodes);
  const sourceNode = internalSource || storeNodes.find((n) => n.id === source);
  const targetNode = internalTarget || storeNodes.find((n) => n.id === target);

  const sourceRatio = typeof (props.data as any)?.sourceRatio === 'number' ? (props.data as any).sourceRatio : 0.5;
  const targetRatio = typeof (props.data as any)?.targetRatio === 'number' ? (props.data as any).targetRatio : 0.5;

  let sx = sourceX;
  let sy = sourceY;
  let sPos = sourcePosition || Position.Right;
  let tx = targetX;
  let ty = targetY;
  let tPos = targetPosition || Position.Left;
  let routingAvoidancePath: string | null | undefined = null;
  let routingLabelX: number | undefined;
  let routingLabelY: number | undefined;

  if (sourceNode && targetNode) {
    const routing = getSmartEdgeRouting(
      sourceNode,
      targetNode,
      sourceHandleId,
      targetHandleId,
      storeNodes,
      sourceRatio,
      targetRatio,
      type
    );
    sx = routing.sourceX;
    sy = routing.sourceY;
    sPos = routing.sourcePos;
    tx = routing.targetX;
    ty = routing.targetY;
    tPos = routing.targetPos;
    routingAvoidancePath = routing.avoidancePath;
    routingLabelX = routing.labelX;
    routingLabelY = routing.labelY;
  }

  let path = '';
  let labelX = routingLabelX ?? (sx + tx) / 2;
  let labelY = routingLabelY ?? (sy + ty) / 2;

  if (routingAvoidancePath) {
    path = routingAvoidancePath;
  } else if (type === 'straight') {
    const [p, lx, ly] = getStraightPath({ sourceX: sx, sourceY: sy, targetX: tx, targetY: ty });
    path = p;
    labelX = lx;
    labelY = ly;
  } else if (type === 'step') {
    const [p, lx, ly] = getSmoothStepPath({
      sourceX: sx,
      sourceY: sy,
      sourcePosition: sPos,
      targetX: tx,
      targetY: ty,
      targetPosition: tPos,
      borderRadius: 0,
    });
    path = p;
    labelX = lx;
    labelY = ly;
  } else if (type === 'smoothstep') {
    const [p, lx, ly] = getSmoothStepPath({
      sourceX: sx,
      sourceY: sy,
      sourcePosition: sPos,
      targetX: tx,
      targetY: ty,
      targetPosition: tPos,
      borderRadius: 12,
    });
    path = p;
    labelX = lx;
    labelY = ly;
  } else {
    // Default / bezier
    const [p, lx, ly] = getBezierPath({
      sourceX: sx,
      sourceY: sy,
      sourcePosition: sPos,
      targetX: tx,
      targetY: ty,
      targetPosition: tPos,
    });
    path = p;
    labelX = lx;
    labelY = ly;
  }

  // Pointer drag handler for endpoint handles
  const handlePointerDown = (
    e: React.PointerEvent<SVGGElement>,
    which: 'source' | 'target'
  ) => {
    e.stopPropagation();
    e.preventDefault();

    const node = which === 'source' ? sourceNode : targetNode;
    if (!node) return;

    const nw = node.measured?.width ?? node.width ?? 150;
    const nh = node.measured?.height ?? node.height ?? 80;
    const allStoreNodes = useDiagramStore.getState().nodes;
    const absPos = getAbsolutePosition(node, allStoreNodes);
    const nx = absPos.x;
    const ny = absPos.y;

    const onPointerMove = (moveEvt: PointerEvent) => {
      const flowPos = screenToFlowPosition({ x: moveEvt.clientX, y: moveEvt.clientY });
      const { face, ratio } = projectPointToNodeBox(flowPos.x, flowPos.y, nx, ny, nw, nh);

      const currentEdge = useDiagramStore.getState().edges.find((e) => e.id === id);
      const currentData = (currentEdge?.data as any) || (props.data as any) || {};

      if (which === 'source') {
        useDiagramStore.getState().updateEdge(id, {
          sourceHandle: face,
          data: {
            ...currentData,
            sourceRatio: ratio,
          },
        });
      } else {
        useDiagramStore.getState().updateEdge(id, {
          targetHandle: face,
          data: {
            ...currentData,
            targetRatio: ratio,
          },
        });
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        labelX={labelX}
        labelY={labelY}
        label={label}
        labelStyle={labelStyle}
        labelShowBg={labelShowBg}
        labelBgStyle={labelBgStyle}
        labelBgPadding={labelBgPadding}
        labelBgBorderRadius={labelBgBorderRadius}
        style={style}
        markerEnd={markerEnd}
        markerStart={markerStart}
        interactionWidth={interactionWidth}
      />
      {selected && (
        <g className="smart-edge-handles" style={{ pointerEvents: 'all' }}>
          {/* Source endpoint handle */}
          <g
            transform={`translate(${sx}, ${sy})`}
            className="cursor-grab active:cursor-grabbing group/edge-handle"
            onPointerDown={(e) => handlePointerDown(e, 'source')}
            style={{ pointerEvents: 'all' }}
          >
            {/* Invisible expanded hit target */}
            <circle r={14} fill="transparent" />
            {/* Subtle blue halo */}
            <circle r={8} fill="#3b82f6" fillOpacity={0.25} />
            {/* Core handle disc */}
            <circle
              r={5.5}
              fill="#ffffff"
              stroke="#3b82f6"
              strokeWidth={2.5}
              className="transition-transform group-hover/edge-handle:scale-125"
            />
          </g>

          {/* Target endpoint handle */}
          <g
            transform={`translate(${tx}, ${ty})`}
            className="cursor-grab active:cursor-grabbing group/edge-handle"
            onPointerDown={(e) => handlePointerDown(e, 'target')}
            style={{ pointerEvents: 'all' }}
          >
            <circle r={14} fill="transparent" />
            <circle r={8} fill="#3b82f6" fillOpacity={0.25} />
            <circle
              r={5.5}
              fill="#ffffff"
              stroke="#3b82f6"
              strokeWidth={2.5}
              className="transition-transform group-hover/edge-handle:scale-125"
            />
          </g>
        </g>
      )}
    </>
  );
});
