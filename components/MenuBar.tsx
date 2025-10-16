'use client'; // Mark as Client Component

import Link from 'next/link';
import { HouseIcon, UserIcon, PuzzlePieceIcon, GearIcon, GlobeIcon } from '@phosphor-icons/react';

export const MenuBar = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-[#3C9EEB] to-[#15C7CB] p-4 flex justify-around items-center shadow-lg">
      <Link href="/home" className="flex flex-col items-center text-white hover:text-gray-200 transition-colors">
        <HouseIcon size={24} />
        <span className="text-xs mt-1">Home</span>
      </Link>
      <Link href="/task" className="flex flex-col items-center text-white hover:text-gray-200 transition-colors">
        <UserIcon size={24} />
        <span className="text-xs mt-1">Task</span>
      </Link>
      <Link href="/alfred" className="flex flex-col items-center text-white hover:text-gray-200 transition-colors">
        <GlobeIcon size={24} />
        <span className="text-xs mt-1">Alfred</span>
      </Link>
      <Link href="/calendar" className="flex flex-col items-center text-white hover:text-gray-200 transition-colors">
        <PuzzlePieceIcon size={24} />
        <span className="text-xs mt-1">Calender</span>
      </Link>
      <Link href="/settings" className="flex flex-col items-center text-white hover:text-gray-200 transition-colors">
        <GearIcon size={24} />
        <span className="text-xs mt-1">Settings</span>
      </Link>
    </nav>
  );
};