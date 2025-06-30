import { useEffect, useState, useRef } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
// replace icons with your own if needed
import { FiUserCheck, FiCheckCircle, FiFolderPlus, FiUsers} from "react-icons/fi";

import "./Carousel.css";

const DEFAULT_ITEMS = [
  {
    title: "Bước 1: Thông tin cơ bản",
    description: "Nhập tên nhóm và tải lên ảnh đại diện cho nhóm của bạn",
    id: 1,
    icon: <FiFolderPlus className="carousel-icon" />,
  },
  {
    title: "Bước 2: Thêm và quản lý thành viên",
    description: "Nhập username để thêm thành viên vào nhóm và quản lý thành viên đã thêm",
    id: 2,
    icon: <FiUsers className="carousel-icon" />,
  },
  {
    title: "Bước 3: Tạo nhóm",
    description: "Kiểm tra thông tin nhóm",
    id: 3,
    icon: <FiUserCheck className="carousel-icon" />,
  },
  {
    title: "Bước 4: Hoàn thành",
    description: "Nhấn nút Xác nhận để hoàn tất",
    id: 4,
    icon: <FiCheckCircle className="carousel-icon" />,
  },
];

const DRAG_BUFFER = 0;
const VELOCITY_THRESHOLD = 500;
const GAP = 16;
const SPRING_OPTIONS = { type: "spring", stiffness: 300, damping: 30 };

const getItemsByStatus = (status) => {
  if (status === "edit") {
    return [
      {
        title: "Bước 1: Sửa thông tin nhóm",
        description: "Chỉnh sửa tên nhóm hoặc ảnh đại diện",
        id: 1,
        icon: <FiFolderPlus className="carousel-icon" />,
      },
      {
        title: "Bước 2: Quản lý thành viên",
        description: "Thêm/xóa thành viên trong nhóm",
        id: 2,
        icon: <FiUsers className="carousel-icon" />,
      },
      {
        title: "Bước 3: Lưu thay đổi",
        description: "Kiểm tra lại thông tin trước khi lưu",
        id: 3,
        icon:  <FiUserCheck className="carousel-icon" />,
      },
      {
        title: "Bước 4: Hoàn thành",
        description: "Nhấn nút Xác nhận để hoàn tất",
        id: 4,
        icon: <FiCheckCircle className="carousel-icon" />,
      },
    ];
  }
  // Mặc định là create
  return DEFAULT_ITEMS;
};

export default function Carousel({
  status = "create",
  baseWidth = 300,
  autoplay = false,
  autoplayDelay = 3000,
  pauseOnHover = false,
  loop = false,
  round = false,
  currentIndex = 0,
  onIndexChange = () => {},
}) {
  const items = getItemsByStatus(status);
  const containerPadding = 16;
  const itemWidth = baseWidth - containerPadding * 2;
  const trackItemOffset = itemWidth + GAP;

  const carouselItems = loop ? [...items, items[0]] : items;
  const [isHovered, setIsHovered] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const containerRef = useRef(null);
  const x = useMotionValue(0);

  useEffect(() => {
    if (pauseOnHover && containerRef.current) {
      const container = containerRef.current;
      const handleMouseEnter = () => setIsHovered(true);
      const handleMouseLeave = () => setIsHovered(false);
      container.addEventListener("mouseenter", handleMouseEnter);
      container.addEventListener("mouseleave", handleMouseLeave);
      return () => {
        container.removeEventListener("mouseenter", handleMouseEnter);
        container.removeEventListener("mouseleave", handleMouseLeave);
      };
    }
  }, [pauseOnHover]);

  useEffect(() => {
    if (autoplay && (!pauseOnHover || !isHovered)) {
      const timer = setInterval(() => {
        onIndexChange((prev) => {
          if (prev === items.length - 1 && loop) {
            return prev + 1;
          }
          if (prev === carouselItems.length - 1) {
            return loop ? 0 : prev;
          }
          return prev + 1;
        });
      }, autoplayDelay);
      return () => clearInterval(timer);
    }
  }, [
    autoplay,
    autoplayDelay,
    isHovered,
    loop,
    items.length,
    carouselItems.length,
    pauseOnHover,
    onIndexChange,
  ]);

  const effectiveTransition = isResetting ? { duration: 0 } : SPRING_OPTIONS;

  const handleAnimationComplete = () => {
    if (loop && currentIndex === carouselItems.length - 1) {
      setIsResetting(true);
      x.set(0);
      onIndexChange(0);
      setTimeout(() => setIsResetting(false), 50);
    }
  };

  const handleDragEnd = (_, info) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;
    if (offset < -DRAG_BUFFER || velocity < -VELOCITY_THRESHOLD) {
      if (loop && currentIndex === items.length - 1) {
        onIndexChange(currentIndex + 1); // Go to clone.
      } else {
        onIndexChange((prev) => Math.min(prev + 1, carouselItems.length - 1));
      }
    } else if (offset > DRAG_BUFFER || velocity > VELOCITY_THRESHOLD) {
      if (loop && currentIndex === 0) {
        onIndexChange(items.length - 1);
      } else {
        onIndexChange((prev) => Math.max(prev - 1, 0));
      }
    }
  };

  const dragProps = loop
    ? {}
    : {
      dragConstraints: {
        left: -trackItemOffset * (carouselItems.length - 1),
        right: 0,
      },
    };

  return (
    <div
      ref={containerRef}
      className={`carousel-container ${round ? "round" : ""}`}
      style={{
        width: `${baseWidth}px`,
        ...(round && { height: `${baseWidth}px`, borderRadius: "50%" }),
      }}
    >
      <motion.div
        className="carousel-track"
        drag="x"
        {...dragProps}
        style={{
          width: itemWidth,
          gap: `${GAP}px`,
          perspective: 1000,
          perspectiveOrigin: `${currentIndex * trackItemOffset + itemWidth / 2}px 50%`,
          x,
        }}
        onDragEnd={handleDragEnd}
        animate={{ x: -(currentIndex * trackItemOffset) }}
        transition={effectiveTransition}
        onAnimationComplete={handleAnimationComplete}
      >
        {carouselItems.map((item, index) => {
          const range = [
            -(index + 1) * trackItemOffset,
            -index * trackItemOffset,
            -(index - 1) * trackItemOffset,
          ];
          const outputRange = [90, 0, -90];
          // eslint-disable-next-line react-hooks/rules-of-hooks
          const rotateY = useTransform(x, range, outputRange, { clamp: false });
          return (
            <motion.div
              key={index}
              className={`carousel-item ${round ? "round" : ""}`}
              style={{
                width: itemWidth,
                height: round ? itemWidth : "100%",
                rotateY: rotateY,
                ...(round && { borderRadius: "50%" }),
              }}
              transition={effectiveTransition}
            >
              <div className={`carousel-item-header ${round ? "round" : ""}`}>
                <span className="carousel-icon-container">
                  {item.icon}
                </span>
              </div>
              <div className="carousel-item-content">
                <div className="carousel-item-title">{item.title}</div>
                <p className="carousel-item-description">{item.description}</p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
      <div className={`carousel-indicators-container ${round ? "round" : ""}`}>
        <div className="carousel-indicators">
          {items.map((_, index) => (
            <motion.div
              key={index}
              className={`carousel-indicator ${currentIndex % items.length === index ? "active" : "inactive"
                }`}
              animate={{
                scale: currentIndex % items.length === index ? 1.2 : 1,
              }}
              onClick={() => onIndexChange(index)}
              transition={{ duration: 0.15 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
