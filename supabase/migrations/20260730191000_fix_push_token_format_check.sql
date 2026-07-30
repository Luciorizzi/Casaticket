alter table public.push_tokens drop constraint if exists push_tokens_expo_push_token_check;
alter table public.push_tokens add constraint push_tokens_expo_push_token_check
check (expo_push_token ~ '^ExponentPushToken\[[A-Za-z0-9_-]+\]$|^ExpoPushToken\[[A-Za-z0-9_-]+\]$');
