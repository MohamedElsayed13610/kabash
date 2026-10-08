"use client";

import { useEffect, useRef, useState } from "react";
import { Reorder, useDragControls } from "motion/react";

interface Controls {
  /** Drag handle: put it anywhere in the row. */
  handle: React.ReactNode;
  /** Keyboard / accessibility fallback. */
  up: React.ReactNode;
  down: React.ReactNode;
}

function Row<T extends { id: string }>({
  item,
  index,
  total,
  onDragEnd,
  onMove,
  render,
}: {
  item: T;
  index: number;
  total: number;
  onDragEnd: () => void;
  onMove: (dir: -1 | 1) => void;
  render: (item: T, c: Controls) => React.ReactNode;
}) {
  const controls = useDragControls();
  const arrow = "grid size-9 place-items-center rounded-full text-charcoal/70 disabled:opacity-25";
  return (
    <Reorder.Item
      value={item}
      as="li"
      layout="position"
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.02, boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}
      className="relative list-none"
    >
      {render(item, {
        handle: (
          <button
            type="button"
            aria-label="اسحب لتغيير الترتيب"
            onPointerDown={(e) => controls.start(e)}
            className="grid size-11 shrink-0 cursor-grab touch-none place-items-center rounded-full text-xl text-charcoal/70"
          >
            ⠿
          </button>
        ),
        up: (
          <button type="button" aria-label="لفوق" disabled={index === 0} onClick={() => onMove(-1)} className={arrow}>
            ▲
          </button>
        ),
        down: (
          <button type="button" aria-label="لتحت" disabled={index === total - 1} onClick={() => onMove(1)} className={arrow}>
            ▼
          </button>
        ),
      })}
    </Reorder.Item>
  );
}

/**
 * Drag-to-reorder. Keeps its own order while you drag and calls onCommit(ids) once when you let go.
 * When the server data changes (items prop), the local order resets to it.
 */
export function SortableList<T extends { id: string }>({
  items,
  onCommit,
  render,
  className = "space-y-2",
}: {
  items: T[];
  onCommit: (ids: string[]) => void;
  render: (item: T, c: Controls) => React.ReactNode;
  className?: string;
}) {
  const [order, setOrder] = useState(items);
  const latest = useRef(order);
  latest.current = order;
  useEffect(() => setOrder(items), [items]);

  const commit = () => {
    const ids = latest.current.map((i) => i.id);
    if (ids.join() !== items.map((i) => i.id).join()) onCommit(ids);
  };

  return (
    <Reorder.Group as="ul" axis="y" values={order} onReorder={setOrder} className={className}>
      {order.map((item, i) => (
        <Row
          key={item.id}
          item={item}
          index={i}
          total={order.length}
          onDragEnd={commit}
          onMove={(dir) => {
            const next = [...latest.current];
            const j = i + dir;
            if (j < 0 || j >= next.length) return;
            [next[i], next[j]] = [next[j], next[i]];
            setOrder(next);
            onCommit(next.map((x) => x.id));
          }}
          render={render}
        />
      ))}
    </Reorder.Group>
  );
}
