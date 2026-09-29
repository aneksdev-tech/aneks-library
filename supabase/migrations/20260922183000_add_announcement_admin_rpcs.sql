-- ============================================================
-- Aneks Library
-- Announcement Administration RPCs + Audit History
--
-- Authorization:
--   Admin     -> full announcement management
--   Co-admin  -> full announcement management
--   Staff     -> announcement management, limited to own records
--
-- Lecturer does NOT receive announcement administration.
-- ============================================================


-- ============================================================
-- 1. CREATE ANNOUNCEMENT
-- ============================================================

create or replace function public.admin_create_announcement(
  _title text,
  _body text,
  _content text default null,
  _link text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid;
  _announcement_id uuid;
  _active public.announcements%rowtype;
  _new public.announcements%rowtype;
begin
  _user_id := auth.uid();

  if _user_id is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.is_admin_or_coadmin(_user_id)
    or public.has_role(
      _user_id,
      'staff'::public.app_role
    )
  ) then
    raise exception 'Admin, Co-admin or Staff access required';
  end if;

  if nullif(trim(_title), '') is null then
    raise exception 'Announcement title is required';
  end if;

  if nullif(trim(_body), '') is null then
    raise exception 'Announcement body is required';
  end if;

  -- Only one non-deleted announcement can be active.
  -- Record every announcement automatically deactivated by creation.
  for _active in
    select *
    from public.announcements
    where is_active = true
      and deleted_at is null
    for update
  loop
    update public.announcements
    set
      is_active = false,
      updated_by = _user_id,
      updated_at = now()
    where id = _active.id;

    insert into public.announcement_audit_logs (
      announcement_id,
      performed_by,
      action,
      reason,
      old_data,
      new_data
    )
    values (
      _active.id,
      _user_id,
      'deactivate',
      'Automatically deactivated because a new announcement was created.',
      to_jsonb(_active),
      to_jsonb(
        jsonb_build_object(
          'id', _active.id,
          'title', _active.title,
          'body', _active.body,
          'content', _active.content,
          'link', _active.link,
          'is_active', false,
          'created_by', _active.created_by,
          'updated_by', _user_id,
          'deleted_by', _active.deleted_by,
          'created_at', _active.created_at,
          'updated_at', now(),
          'deleted_at', _active.deleted_at,
          'deletion_reason', _active.deletion_reason
        )
      )
    );
  end loop;

  insert into public.announcements (
    title,
    body,
    content,
    link,
    is_active,
    created_by,
    updated_by,
    created_at,
    updated_at
  )
  values (
    trim(_title),
    trim(_body),
    nullif(trim(_content), ''),
    nullif(trim(_link), ''),
    true,
    _user_id,
    _user_id,
    now(),
    now()
  )
  returning *
  into _new;

  _announcement_id := _new.id;

  insert into public.announcement_audit_logs (
    announcement_id,
    performed_by,
    action,
    reason,
    old_data,
    new_data
  )
  values (
    _announcement_id,
    _user_id,
    'create',
    'Announcement created.',
    null,
    to_jsonb(_new)
  );

  return _announcement_id;
end;
$$;


-- ============================================================
-- 2. EDIT ANNOUNCEMENT
-- ============================================================

create or replace function public.admin_edit_announcement(
  _announcement_id uuid,
  _title text,
  _body text,
  _content text default null,
  _link text default null,
  _edit_summary text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid;
  _old public.announcements%rowtype;
  _new public.announcements%rowtype;
  _summary text;
begin
  _user_id := auth.uid();

  if _user_id is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.is_admin_or_coadmin(_user_id)
    or public.has_role(
      _user_id,
      'staff'::public.app_role
    )
  ) then
    raise exception 'Admin, Co-admin or Staff access required';
  end if;

  if nullif(trim(_title), '') is null then
    raise exception 'Announcement title is required';
  end if;

  if nullif(trim(_body), '') is null then
    raise exception 'Announcement body is required';
  end if;

  _summary := nullif(trim(_edit_summary), '');

  -- Lock and retrieve the actual current database record.
  select *
  into _old
  from public.announcements
  where id = _announcement_id
  for update;

  if not found then
    raise exception 'Announcement not found';
  end if;

  if _old.deleted_at is not null then
    raise exception 'Deleted announcements cannot be edited';
  end if;

  -- Staff may edit only announcements they created.
  if public.has_role(
    _user_id,
    'staff'::public.app_role
  )
  and not public.is_admin_or_coadmin(_user_id)
  and _old.created_by is distinct from _user_id then
    raise exception 'Staff can only edit announcements they created';
  end if;

  -- Compare actual database values, not form/touched state.
  if
    _old.title is not distinct from trim(_title)
    and _old.body is not distinct from trim(_body)
    and _old.content is not distinct from nullif(trim(_content), '')
    and _old.link is not distinct from nullif(trim(_link), '')
  then
    return jsonb_build_object(
      'id', _announcement_id,
      'changed', false
    );
  end if;

  if _summary is null then
    raise exception 'Edit summary is required when changes are made';
  end if;

  update public.announcements
  set
    title = trim(_title),
    body = trim(_body),
    content = nullif(trim(_content), ''),
    link = nullif(trim(_link), ''),
    updated_by = _user_id,
    updated_at = now()
  where id = _announcement_id
  returning *
  into _new;

  insert into public.announcement_audit_logs (
    announcement_id,
    performed_by,
    action,
    reason,
    old_data,
    new_data
  )
  values (
    _announcement_id,
    _user_id,
    'edit',
    _summary,
    to_jsonb(_old),
    to_jsonb(_new)
  );

  return jsonb_build_object(
    'id', _announcement_id,
    'changed', true
  );
end;
$$;


-- ============================================================
-- 3. ACTIVATE / DEACTIVATE ANNOUNCEMENT
-- ============================================================

create or replace function public.admin_toggle_announcement(
  _announcement_id uuid,
  _is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid;
  _target public.announcements%rowtype;
  _active public.announcements%rowtype;
  _updated public.announcements%rowtype;
begin
  _user_id := auth.uid();

  if _user_id is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.is_admin_or_coadmin(_user_id)
    or public.has_role(
      _user_id,
      'staff'::public.app_role
    )
  ) then
    raise exception 'Admin, Co-admin or Staff access required';
  end if;

  -- Lock the target announcement.
  select *
  into _target
  from public.announcements
  where id = _announcement_id
  for update;

  if not found then
    raise exception 'Announcement not found';
  end if;

  if _target.deleted_at is not null then
    raise exception 'Deleted announcements cannot be activated or deactivated';
  end if;

  -- Staff may manage only announcements they created.
  if public.has_role(
    _user_id,
    'staff'::public.app_role
  )
  and not public.is_admin_or_coadmin(_user_id)
  and _target.created_by is distinct from _user_id then
    raise exception 'Staff can only manage announcements they created';
  end if;

  -- Nothing actually changes.
  if _target.is_active is not distinct from _is_active then
    return jsonb_build_object(
      'id', _announcement_id,
      'changed', false
    );
  end if;

  -- Activating one announcement automatically deactivates
  -- any other active announcement.
  if _is_active = true then
    for _active in
      select *
      from public.announcements
      where is_active = true
        and deleted_at is null
        and id <> _announcement_id
      for update
    loop
      update public.announcements
      set
        is_active = false,
        updated_by = _user_id,
        updated_at = now()
      where id = _active.id
      returning *
      into _updated;

      insert into public.announcement_audit_logs (
        announcement_id,
        performed_by,
        action,
        reason,
        old_data,
        new_data
      )
      values (
        _active.id,
        _user_id,
        'deactivate',
        'Automatically deactivated because another announcement was activated.',
        to_jsonb(_active),
        to_jsonb(_updated)
      );
    end loop;
  end if;

  update public.announcements
  set
    is_active = _is_active,
    updated_by = _user_id,
    updated_at = now()
  where id = _announcement_id
  returning *
  into _updated;

  insert into public.announcement_audit_logs (
    announcement_id,
    performed_by,
    action,
    reason,
    old_data,
    new_data
  )
  values (
    _announcement_id,
    _user_id,
    case
      when _is_active then 'activate'
      else 'deactivate'
    end,
    case
      when _is_active then 'Announcement activated.'
      else 'Announcement deactivated.'
    end,
    to_jsonb(_target),
    to_jsonb(_updated)
  );

  return jsonb_build_object(
    'id', _announcement_id,
    'changed', true
  );
end;
$$;


-- ============================================================
-- 4. SOFT DELETE ANNOUNCEMENT
-- ============================================================

create or replace function public.admin_delete_announcement(
  _announcement_id uuid,
  _deletion_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid;
  _old public.announcements%rowtype;
  _new public.announcements%rowtype;
  _reason text;
begin
  _user_id := auth.uid();

  if _user_id is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.is_admin_or_coadmin(_user_id)
    or public.has_role(
      _user_id,
      'staff'::public.app_role
    )
  ) then
    raise exception 'Admin, Co-admin or Staff access required';
  end if;

  _reason := nullif(trim(_deletion_reason), '');

  if _reason is null then
    raise exception 'Deletion reason is required';
  end if;

  select *
  into _old
  from public.announcements
  where id = _announcement_id
  for update;

  if not found then
    raise exception 'Announcement not found';
  end if;

  if _old.deleted_at is not null then
    raise exception 'Announcement is already deleted';
  end if;

  -- Staff may delete only announcements they created.
  if public.has_role(
    _user_id,
    'staff'::public.app_role
  )
  and not public.is_admin_or_coadmin(_user_id)
  and _old.created_by is distinct from _user_id then
    raise exception 'Staff can only delete announcements they created';
  end if;

  update public.announcements
  set
    is_active = false,
    deleted_by = _user_id,
    deleted_at = now(),
    deletion_reason = _reason,
    updated_by = _user_id,
    updated_at = now()
  where id = _announcement_id
  returning *
  into _new;

  insert into public.announcement_audit_logs (
    announcement_id,
    performed_by,
    action,
    reason,
    old_data,
    new_data
  )
  values (
    _announcement_id,
    _user_id,
    'delete',
    _reason,
    to_jsonb(_old),
    to_jsonb(_new)
  );

  return _announcement_id;
end;
$$;


-- ============================================================
-- 5. GRANT EXECUTION TO AUTHENTICATED USERS
-- ============================================================

grant execute on function public.admin_create_announcement(
  text,
  text,
  text,
  text
) to authenticated;

grant execute on function public.admin_edit_announcement(
  uuid,
  text,
  text,
  text,
  text,
  text
) to authenticated;

grant execute on function public.admin_toggle_announcement(
  uuid,
  boolean
) to authenticated;

grant execute on function public.admin_delete_announcement(
  uuid,
  text
) to authenticated;