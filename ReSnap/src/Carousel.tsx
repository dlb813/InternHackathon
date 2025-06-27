import React, { useEffect, useRef, useState } from "react";

export default function EbayCarousel({ items }: { items: { image: string; title: string; price: { value: string } }[] }) {
  const visibleCount = 3;
  const CARD_WIDTH = 160;
  const GAP = 16;

  const [index, setIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (items.length <= visibleCount) return;
    timeoutRef.current = setTimeout(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setIsAnimating(false);
        setIndex((prev) => (prev + 1) % items.length);
      }, 500);
    }, 2500);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [index, items.length]);

  const getVisible = () => {
    const arr = [];
    for (let i = 0; i < Math.min(visibleCount + 1, items.length); i++) {
      arr.push(items[(index + i) % items.length]);
    }
    return arr;
  };

  return (
    <div
      className="overflow-hidden w-full"
      style={{ maxWidth: `520px`, margin: "0 auto", minHeight: 100 }}
    >
      <div
        className="flex"
        style={{
          width: (CARD_WIDTH + GAP) * getVisible().length,
          transform: `translateX(${isAnimating ? -CARD_WIDTH - GAP : 0}px)`,
          transition: isAnimating ? "transform 0.5s cubic-bezier(.4,0,.2,1)" : "none"
        }}
      >
        {getVisible().map((item, idx) => (
          <div
            key={idx}
            className="bg-white rounded-lg shadow-md flex flex-col items-center"
            style={{
              minWidth: CARD_WIDTH,
              maxWidth: CARD_WIDTH,
              marginLeft: idx === 0 ? 0 : GAP / 2,
              marginRight: idx === getVisible().length - 1 ? 0 : GAP / 2,
              padding: 8
            }}
          >
            <img
              src={item.image || "/placeholder.png"}
              alt={item.title}
              className="w-10 h-10 object-contain rounded mb-2 bg-gray-100"
            />
            <div className="text-xs font-semibold text-center mb-1 truncate w-full">{item.title}</div>
            <div className="text-green-700 text-xs font-bold">
              {item.price?.value ? `$${item.price.value}` : "No price"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}