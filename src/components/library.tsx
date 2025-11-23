'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DownloadCloud } from 'lucide-react';

interface LibraryItem {
    title: string;
    description: string;
    shortcutUrl: string;
    author: string;
}

const libraryItems: LibraryItem[] = [
    {
        title: 'Battery Level Trigger',
        description: 'An iOS Shortcut that checks your battery level and calls a Flow State deep link. Useful for "low power mode" automations.',
        shortcutUrl: 'https://www.icloud.com/shortcuts/example1',
        author: 'Flow State Team'
    },
    {
        title: 'Wi-Fi Trigger',
        description: 'Trigger a flow when you connect to or disconnect from a specific Wi-Fi network. Great for "at home" or "at work" routines.',
        shortcutUrl: 'https://www.icloud.com/shortcuts/example2',
        author: 'Flow State Team'
    },
    {
        title: 'Location Trigger (Geofence)',
        description: 'Fires an event when you arrive at or leave a specific location. Requires the Shortcut app to have location access.',
        shortcutUrl: 'https://www.icloud.com/shortcuts/example3',
        author: 'Community Contributor'
    },
    {
        title: 'Focus Mode Trigger',
        description: 'Run a flow automatically when you enable or disable a Focus Mode (e.g., "Work", "Sleep").',
        shortcutUrl: 'https://www.icloud.com/shortcuts/example4',
        author: 'Flow State Team'
    }
];

function LibraryItemCard({ item }: { item: LibraryItem }) {
    return (
        <Card className="flex flex-col">
            <CardHeader>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>by {item.author}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground">{item.description}</p>
            </CardContent>
            <CardFooter>
                <Button asChild className="w-full">
                    <a href={item.shortcutUrl} target="_blank" rel="noopener noreferrer">
                        <DownloadCloud className="mr-2 h-4 w-4" />
                        Install Shortcut
                    </a>
                </Button>
            </CardFooter>
        </Card>
    );
}


export function Library() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Integration Library</CardTitle>
        <CardDescription>
            Install these iOS Shortcuts to trigger flows from your device events. This is the bridge between your phone and Flow State.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {libraryItems.map(item => (
            <LibraryItemCard key={item.title} item={item} />
        ))}
      </CardContent>
    </Card>
  );
}
