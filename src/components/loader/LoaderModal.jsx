import React from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Palette, Box, Cloud, RefreshCw } from 'lucide-react';
import { selectLoaderState } from '../../store/redux/loaderSlice';

const LoaderModal = () => {
  const { isLoading, title, message, progress, type } = useSelector(selectLoaderState);

  // Determine icon based on loading type
  const getIcon = () => {
    const iconClass = "w-10 h-10 text-indigo-500 animate-pulse";
    switch (type) {
      case 'texture':
        return <Palette className={iconClass} />;
      case 'model':
        return <Box className={iconClass} />;
      case 'save':
        return <Cloud className={iconClass} />;
      case 'process':
        return <RefreshCw className={`${iconClass} animate-spin`} style={{ animationDuration: '3s' }} />;
      default:
        return <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />;
    }
  };

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md"
        >
          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 15 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/90 p-8 text-center shadow-2xl shadow-indigo-500/10"
          >
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

            {/* Spinner/Icon Wrapper */}
            <div className="relative z-10 flex justify-center mb-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 shadow-inner">
                {/* Beautiful concentric glowing rings */}
                <div className="absolute h-24 w-24 rounded-full border border-indigo-500/20 animate-ping opacity-75" style={{ animationDuration: '2s' }} />
                {getIcon()}
              </div>
            </div>

            {/* Content */}
            <div className="relative z-10 space-y-2">
              <h3 className="text-xl font-bold tracking-tight text-white font-sans">
                {title}
              </h3>
              <p className="text-sm font-medium text-zinc-400 max-w-xs mx-auto leading-relaxed">
                {message}
              </p>
            </div>

            {/* Progress Section */}
            {progress !== null && progress !== undefined && (
              <div className="relative z-10 mt-8 space-y-2">
                {/* Progress Bar Container */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-900 border border-zinc-800 p-[1px]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_12px_rgba(99,102,241,0.5)]"
                  />
                </div>
                {/* Percentage Text */}
                <div className="flex justify-between items-center text-[11px] font-bold text-zinc-500">
                  <span className="uppercase tracking-wider">Progress</span>
                  <span className="text-indigo-400 text-xs font-black">{Math.round(progress)}%</span>
                </div>
              </div>
            )}

            {/* Animated Loading Dots if progress is not present */}
            {(progress === null || progress === undefined) && (
              <div className="relative z-10 flex justify-center space-x-1.5 mt-8">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoaderModal;
