alter table public.short_links
  add column if not exists rotation_mode text not null default 'round_robin',
  add column if not exists rotation_cursor int not null default 0;

alter table public.short_links
  drop constraint if exists short_links_rotation_mode_check;
alter table public.short_links
  add constraint short_links_rotation_mode_check
  check (rotation_mode in ('round_robin','random','weighted','sticky'));

alter table public.short_link_urls
  add column if not exists weight int not null default 1;
alter table public.short_link_urls
  drop constraint if exists short_link_urls_weight_check;
alter table public.short_link_urls
  add constraint short_link_urls_weight_check check (weight >= 0 and weight <= 1000);

drop function if exists public.bump_short_link_click(text);

create or replace function public.bump_short_link_click(_slug text)
returns table(target text, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.short_links%rowtype;
  v_urls_count int;
  v_chosen text;
  v_next_cursor int;
  v_total_weight int;
  v_r int;
  v_acc int := 0;
  v_row record;
begin
  select * into v_link from public.short_links where slug = _slug;
  if not found then
    return query select null::text, 'not_found'::text;
    return;
  end if;
  if v_link.status <> 'active' then
    return query select null::text, v_link.status;
    return;
  end if;

  if not coalesce(v_link.is_rotating, false) then
    v_chosen := v_link.target_url;
  else
    select count(*) into v_urls_count from public.short_link_urls where short_link_id = v_link.id;
    if v_urls_count = 0 then
      v_chosen := v_link.target_url;
    elsif v_link.rotation_mode = 'random' then
      select url into v_chosen from public.short_link_urls
        where short_link_id = v_link.id
        order by random() limit 1;
    elsif v_link.rotation_mode = 'weighted' then
      select coalesce(sum(weight),0) into v_total_weight from public.short_link_urls where short_link_id = v_link.id;
      if v_total_weight <= 0 then
        select url into v_chosen from public.short_link_urls
          where short_link_id = v_link.id order by sort_order limit 1;
      else
        v_r := 1 + floor(random() * v_total_weight)::int;
        for v_row in
          select url, weight from public.short_link_urls where short_link_id = v_link.id order by sort_order
        loop
          v_acc := v_acc + v_row.weight;
          if v_r <= v_acc then
            v_chosen := v_row.url;
            exit;
          end if;
        end loop;
      end if;
    elsif v_link.rotation_mode = 'sticky' then
      v_next_cursor := (coalesce(v_link.rotation_cursor,0)) % v_urls_count;
      select url into v_chosen from public.short_link_urls
        where short_link_id = v_link.id
        order by sort_order offset v_next_cursor limit 1;
      update public.short_links set rotation_cursor = (v_next_cursor + 1) % v_urls_count where id = v_link.id;
    else
      v_next_cursor := (coalesce(v_link.rotation_cursor,0)) % v_urls_count;
      select url into v_chosen from public.short_link_urls
        where short_link_id = v_link.id
        order by sort_order offset v_next_cursor limit 1;
      update public.short_links set rotation_cursor = (v_next_cursor + 1) % v_urls_count where id = v_link.id;
    end if;
  end if;

  update public.short_links
    set click_count = coalesce(click_count,0) + 1,
        last_clicked_at = now()
    where id = v_link.id;

  return query select v_chosen, v_link.status;
end;
$$;