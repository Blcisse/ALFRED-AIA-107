import * as React from 'react';
import type { MessageFormatter, ReceivedChatMessage } from '@livekit/components-react';
import { useChatMessage } from './hooks/utils';
import { cn } from '../../../lib/utils';

export interface ChatEntryProps extends React.HTMLAttributes<HTMLLIElement> {
  entry: ReceivedChatMessage;
  hideName?: boolean;
  hideTimestamp?: boolean;
  messageFormatter?: MessageFormatter;
}

export const ChatEntry = ({
  entry,
  messageFormatter,
  hideName,
  hideTimestamp,
  className,
  ...props
}: ChatEntryProps) => {
  const { message, hasBeenEdited, time, locale, name } = useChatMessage(entry, messageFormatter);

  const isUser = entry.from?.isLocal ?? false;
  const messageOrigin = isUser ? 'remote' : 'local';

  return (
    <li
      data-lk-message-origin={messageOrigin}
      title={time.toLocaleTimeString(locale, { timeStyle: 'full' })}
      className={cn('group flex flex-col gap-0.5', className)}
      {...props}
    >
      {(!hideTimestamp || !hideName || hasBeenEdited) && (
        <span className="text-muted-foreground flex text-sm">
          {!hideName && <strong className="mt-2">{name}</strong>}

          {!hideTimestamp && (
            <span className="align-self-end ml-auto font-mono text-xs opacity-0 transition-opacity ease-linear group-hover:opacity-100">
              {hasBeenEdited && '*'}
              {time.toLocaleTimeString(locale, { timeStyle: 'short' })}
            </span>
          )}
        </span>
      )}

      <span
        className={cn(
          'max-w-4/5 rounded-[20px] p-2',
          isUser
            ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white ml-auto'
            : 'bg-gradient-to-r from-gray-200 to-gray-300 text-black mr-auto'
        )}
      >
        {message}
      </span>
    </li>
  );
};