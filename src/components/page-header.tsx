'use client';

import { ReactNode } from 'react';
import { SettingsMenu } from '@/components/settings-menu';

interface PageHeaderProps {
  title: string;
  description: string;
  children?: ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        {children}
        <SettingsMenu />
      </div>
    </div>
  );
}
