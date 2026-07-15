-- Trigger functions are internal: nobody should call them over the RPC API.
revoke execute on function public.trg_post_notify() from public, anon, authenticated;
revoke execute on function public.trg_fault_created() from public, anon, authenticated;
revoke execute on function public.trg_fault_event_notify() from public, anon, authenticated;
revoke execute on function public.trg_complaint_notify() from public, anon, authenticated;
revoke execute on function public.trg_message_notify() from public, anon, authenticated;
revoke execute on function public.trg_meeting_notify() from public, anon, authenticated;
revoke execute on function public.trg_poll_notify() from public, anon, authenticated;
revoke execute on function public.trg_set_post_identity() from public, anon, authenticated;
revoke execute on function public.trg_set_comment_identity() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Callable helpers stay for signed-in users only, never for anon.
revoke execute on function public.notify_unit(uuid, text, text, text) from public, anon;
revoke execute on function public.remind_charge(uuid) from public, anon;
revoke execute on function public.redeem_access_code(text) from public, anon;
revoke execute on function public.admin_activity(integer) from public, anon;
