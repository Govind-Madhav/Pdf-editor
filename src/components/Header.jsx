import { Layers, Wifi, WifiOff } from 'lucide-react';
import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { motion, AnimatePresence } from 'framer-motion';

export default function Header() {
    const isOnline = useOnlineStatus();

    return (
        <header className="text-center space-y-4 mb-8">
            <div className="flex flex-col items-center">
                <div className="flex items-center justify-center gap-3 text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500">
                    <Layers className="w-10 h-10 text-indigo-500" />
                    <span>Infinity Merge</span>
                </div>

                <AnimatePresence>
                    {!isOnline && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex items-center gap-2 text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full text-xs font-medium mt-3 border border-rose-500/20"
                        >
                            <WifiOff size={12} />
                            <span>Offline Mode Active</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            <p className="text-slate-400 text-lg">
                Merge unlimited PDFs securely in your browser.
            </p>
        </header>
    );
}
