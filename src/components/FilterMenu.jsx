import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ASPECT_RATIO_OPTIONS,
  COLOR_OPTIONS,
  FILE_TYPE_OPTIONS,
  RESOLUTION_PRESETS,
  SORT_OPTIONS,
  TIME_RANGE_OPTIONS,
  VIEW_MODES,
} from '../constants';

const FilterMenuContext = createContext(null);

export function FilterMenuProvider({ children }) {
  const [openId, setOpenId] = useState(null);
  return (
    <FilterMenuContext.Provider value={{ openId, setOpenId }}>
      {children}
    </FilterMenuContext.Provider>
  );
}

function FilterMenu({ id, ariaLabel, disabled, menuClassName, menuMaxHeight = 360, trigger, header, footer, children }) {
  const menuContext = useContext(FilterMenuContext);
  const open = menuContext?.openId === id;
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const maxHeightRef = useRef(menuMaxHeight);
  maxHeightRef.current = menuMaxHeight;
  const [style, setStyle] = useState(null);

  const close = () => menuContext?.setOpenId(null);
  const toggle = () => menuContext?.setOpenId(open ? null : id);

  const place = () => {
    const triggerButton = rootRef.current?.querySelector('.filter-menu-trigger');
    const menu = menuRef.current;
    if (!triggerButton || !menu) return;

    const rect = triggerButton.getBoundingClientRect();
    const gap = 6;
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    let left = rect.left;
    if (left + menuWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - menuWidth - 8);
    }

    const spaceBelow = window.innerHeight - rect.bottom - gap - 8;
    const spaceAbove = rect.top - gap - 8;
    let top = rect.bottom + gap;
    let maxHeight = Math.min(maxHeightRef.current, spaceBelow);
    if (spaceBelow < Math.min(menuHeight, 200) && spaceAbove > spaceBelow) {
      maxHeight = Math.min(maxHeightRef.current, spaceAbove);
      top = Math.max(8, rect.top - gap - Math.min(menuHeight, maxHeight));
    }

    setStyle({
      position: 'fixed',
      left,
      top,
      maxHeight,
      visibility: 'visible',
    });
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    place();
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const onPlace = () => place();
    const onPointerDown = (event) => {
      const target = event.target;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      close();
      rootRef.current?.querySelector('.filter-menu-trigger')?.focus();
    };
    const onFocusOut = (event) => {
      const next = event.relatedTarget;
      if (rootRef.current?.contains(next) || menuRef.current?.contains(next)) return;
      close();
    };

    window.addEventListener('resize', onPlace);
    window.addEventListener('scroll', onPlace, true);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    rootRef.current?.addEventListener('focusout', onFocusOut);
    menuRef.current?.addEventListener('focusout', onFocusOut);
    return () => {
      window.removeEventListener('resize', onPlace);
      window.removeEventListener('scroll', onPlace, true);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      rootRef.current?.removeEventListener('focusout', onFocusOut);
      menuRef.current?.removeEventListener('focusout', onFocusOut);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const list = menuRef.current?.querySelector('.filter-menu-list');
    const selected = list?.querySelector('[role="option"][aria-selected="true"]');
    const target = selected || list?.querySelector('[role="option"]');
    if (list && selected) {
      list.scrollTop = selected.offsetTop - list.clientHeight / 2 + selected.offsetHeight / 2;
    }
    target?.focus({ preventScroll: true });
    return undefined;
  }, [open]);

  const onListKeyDown = (event) => {
    const options = [...event.currentTarget.querySelectorAll('[role="option"]')];
    const current = options.indexOf(document.activeElement);
    let next = null;
    if (event.key === 'ArrowDown') next = options[(current + 1) % options.length];
    else if (event.key === 'ArrowUp') next = options[(current - 1 + options.length) % options.length];
    else if (event.key === 'Home') next = options[0];
    else if (event.key === 'End') next = options[options.length - 1];
    if (!next) return;
    event.preventDefault();
    next.focus();
  };

  return (
    <div className="filter-menu-root" ref={rootRef}>
      <button
        type="button"
        id={id}
        className={`filter-menu-trigger${open ? ' is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={toggle}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            menuContext?.setOpenId(id);
          }
        }}
      >
        <span className="filter-menu-value">{trigger}</span>
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className={`filter-menu${menuClassName ? ` ${menuClassName}` : ''}`}
          style={style || { position: 'fixed', visibility: 'hidden' }}
          onClick={(event) => {
            const option = event.target.closest('[role="option"]');
            if (option && !option.hasAttribute('data-keep-open')) close();
          }}
        >
          {header}
          <div
            className="filter-menu-list"
            role="listbox"
            aria-label={ariaLabel}
            onKeyDown={onListKeyDown}
          >
            {children}
          </div>
          {footer}
        </div>,
        document.body
      )}
    </div>
  );
}

function useCloseFilterMenu() {
  const menuContext = useContext(FilterMenuContext);
  return () => menuContext?.setOpenId(null);
}

function MenuOption({ selected, onSelect, keepOpen = false, children, className = '' }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      data-keep-open={keepOpen ? '' : undefined}
      className={`filter-menu-option${selected ? ' is-selected' : ''}${className ? ` ${className}` : ''}`}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}

function OptionCopy({ label, detail }) {
  return (
    <span className="filter-menu-option-copy">
      <span className="filter-menu-option-label">{label}</span>
      {detail && <span className="filter-menu-option-detail">{detail}</span>}
    </span>
  );
}

function aspectOuterSize(ratio, maxSide) {
  const [width, height] = String(ratio).split('x').map(Number);
  if (!width || !height) return null;
  const scale = maxSide / Math.max(width, height);
  return {
    width: Math.max(4, Math.min(maxSide, Math.round(width * scale))),
    height: Math.max(4, Math.min(maxSide, Math.round(height * scale))),
  };
}

function AspectShape({ ratio, box = 42 }) {
  const frame = box;
  const stroke = 1.5;
  const maxSide = frame - 2;
  const size = ratio ? aspectOuterSize(ratio, maxSide) : { width: maxSide, height: maxSide };
  const left = Math.round((frame - size.width) / 2);
  const top = Math.round((frame - size.height) / 2);
  const radius = ratio
    ? Math.min(1.5, (size.width - stroke) / 5, (size.height - stroke) / 5)
    : 2;

  return (
    <svg
      className={`aspect-shape${ratio ? '' : ' is-any'}`}
      width={frame}
      height={frame}
      viewBox={`0 0 ${frame} ${frame}`}
      aria-hidden="true"
    >
      <rect
        x={left + stroke / 2}
        y={top + stroke / 2}
        width={Math.max(1, size.width - stroke)}
        height={Math.max(1, size.height - stroke)}
        rx={radius}
        fill={ratio ? 'rgba(47, 129, 247, 0.22)' : 'none'}
        stroke={ratio ? '#93c5fd' : 'rgba(148, 163, 184, 0.8)'}
        strokeWidth={stroke}
        strokeDasharray={ratio ? undefined : '2.4 1.8'}
      />
    </svg>
  );
}

function ColorSwatch({ hex }) {
  return (
    <span
      className={`color-swatch${hex ? '' : ' is-any'}`}
      style={hex ? { background: hex } : undefined}
      aria-hidden="true"
    />
  );
}

const PORTRAIT_PHONE_QUERY = '(max-width: 768px) and (orientation: portrait)';

export function usePortraitPhone() {
  const [matches, setMatches] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia(PORTRAIT_PHONE_QUERY).matches
  ));

  useEffect(() => {
    const media = window.matchMedia(PORTRAIT_PHONE_QUERY);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return matches;
}

function ViewPreview({ mode, portraitPhone }) {
  const count = (portraitPhone ? {
    cinematic: 2,
    cozy: 4,
    comfortable: 4,
    compact: 6,
    cramped: 8,
  } : {
    cinematic: 4,
    cozy: 6,
    comfortable: 8,
    compact: 10,
    cramped: 12,
  })[mode] || 8;

  return (
    <span className={`view-preview view-preview-${mode}`} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => <i key={index} />)}
    </span>
  );
}

const RATIO_GROUPS = ['Wide', 'Portrait', 'Square & Other'];

const SORT_DETAILS = {
  '': 'Newest uploads',
  relevance: 'Best match for a search',
  random: 'A new order each fetch',
  views: 'Most viewed',
  favorites: 'Most favorited',
  toplist: 'Highest rated in a time range',
};

const FILE_DETAILS = {
  '': 'JPEG and PNG',
  jpg: 'Smaller files',
  png: 'Lossless',
};

const VIEW_OPTIONS = [
  { value: VIEW_MODES.CRAMPED, label: 'Cramped', detail: 'Smallest cards' },
  { value: VIEW_MODES.COMPACT, label: 'Compact', detail: 'More on screen' },
  { value: VIEW_MODES.COMFORTABLE, label: 'Comfortable', detail: 'Balanced grid' },
  { value: VIEW_MODES.COZY, label: 'Cozy', detail: 'Larger cards' },
  { value: VIEW_MODES.CINEMATIC, label: 'Cinematic', detail: 'Wide cards' },
];

function ratioParts(value) {
  const option = ASPECT_RATIO_OPTIONS.find((item) => item.value === value);
  if (!option) return { ratio: value.replace('x', ':'), name: '' };
  const [ratio, name = ''] = option.label.split(' (');
  return { ratio, name: name.replace(/\)$/, '') };
}

function resolutionParts(label) {
  const match = label.match(/^(.*?)\s+\((.+)\)$/);
  if (!match) return { size: label, note: '' };
  return { size: match[1], note: match[2] };
}

const RESOLUTION_ROWS = [
  ['21x9', '16x9', '16x10', '4x3', '5x4', '3x2'],
  ['32x9', '48x9', '9x16', '10x16', '9x18', '1x1'],
];

const KNOWN_RATIOS = [
  ['16x9', 16 / 9],
  ['16x10', 16 / 10],
  ['21x9', 21 / 9],
  ['32x9', 32 / 9],
  ['48x9', 48 / 9],
  ['9x16', 9 / 16],
  ['9x21', 9 / 21],
  ['10x16', 10 / 16],
  ['9x18', 9 / 18],
  ['2x3', 2 / 3],
  ['1x1', 1],
  ['3x2', 3 / 2],
  ['4x3', 4 / 3],
  ['5x4', 5 / 4],
];

function closestRatio(width, height) {
  const value = width / height;
  let best = null;
  let bestDelta = 0.05;
  KNOWN_RATIOS.forEach(([key, ratio]) => {
    const delta = Math.abs(value - ratio);
    if (delta < bestDelta) {
      best = key;
      bestDelta = delta;
    }
  });
  return best;
}

function useDisplayResolution() {
  return useMemo(() => {
    if (typeof window === 'undefined') return null;
    const width = Math.round(window.screen.width * (window.devicePixelRatio || 1));
    const height = Math.round(window.screen.height * (window.devicePixelRatio || 1));
    const ratio = width / height;
    let apiRatio = '';
    if (Math.abs(ratio - 16 / 9) < 0.1) apiRatio = '16x9';
    else if (Math.abs(ratio - 16 / 10) < 0.1) apiRatio = '16x10';
    else if (Math.abs(ratio - 21 / 9) < 0.1) apiRatio = '21x9';
    else if (Math.abs(ratio - 32 / 9) < 0.1) apiRatio = '32x9';
    else if (Math.abs(ratio - 4 / 3) < 0.1) apiRatio = '4x3';
    else if (Math.abs(ratio - 5 / 4) < 0.1) apiRatio = '5x4';
    else if (Math.abs(ratio - 3 / 2) < 0.1) apiRatio = '3x2';

    return { width, height, value: `${width}x${height}`, apiRatio };
  }, []);
}

export function AspectRatioMenu({ value, onChange }) {
  return (
    <FilterMenu
      id="ratio"
      ariaLabel="Aspect ratio"
      menuClassName="filter-menu-aspect"
      menuMaxHeight={520}
      trigger={(
        <>
          <AspectShape ratio={value} box={16} />
          <span>{value ? value.replace('x', ':') : 'Any'}</span>
        </>
      )}
    >
      <MenuOption className="aspect-any" selected={value === ''} onSelect={() => onChange('')}>
        <AspectShape ratio="" box={42} />
        <OptionCopy label="Any" detail="Every shape" />
      </MenuOption>
      <div className="aspect-columns">
        {RATIO_GROUPS.map((group) => (
          <div className={`aspect-column${group === 'Square & Other' ? ' is-split' : ''}`} key={group}>
            <div className="aspect-column-title">{group}</div>
            {ASPECT_RATIO_OPTIONS.filter((option) => option.group === group).map((option) => {
              const { ratio, name } = ratioParts(option.value);
              return (
                <MenuOption
                  key={option.value}
                  selected={value === option.value}
                  onSelect={() => onChange(option.value)}
                >
                  <AspectShape ratio={option.value} box={42} />
                  <OptionCopy label={ratio} detail={name} />
                </MenuOption>
              );
            })}
          </div>
        ))}
      </div>
    </FilterMenu>
  );
}

function ResolutionColumn({ group, value, onChange, onChooseRatio }) {
  const { ratio: ratioLabel, name } = ratioParts(group.ratio);
  return (
    <div className="resolution-column">
      <button
        type="button"
        className="resolution-column-title"
        onClick={() => onChooseRatio(group.ratio)}
      >
        <AspectShape ratio={group.ratio} box={36} />
        <span className="resolution-column-ratio">{ratioLabel}</span>
        {name && <span>{name}</span>}
      </button>
      {group.items.map((preset) => {
        const { size } = resolutionParts(preset.label);
        return (
          <MenuOption
            key={preset.value}
            className="resolution-cell"
            selected={value === preset.value}
            onSelect={() => onChange(preset.value, preset.ratio)}
          >
            {size}
          </MenuOption>
        );
      })}
    </div>
  );
}

function ResolutionBand({ group, value, onChange }) {
  const { ratio: ratioLabel, name } = ratioParts(group.ratio);
  return (
    <div className="resolution-band">
      <div className="resolution-band-title">
        <AspectShape ratio={group.ratio} box={18} />
        <span>{ratioLabel}</span>
        {name && <span className="resolution-band-name">{name}</span>}
      </div>
      <div className="resolution-band-sizes">
        {group.items.map((preset) => {
          const { size } = resolutionParts(preset.label);
          return (
            <MenuOption
              key={preset.value}
              className="resolution-cell"
              selected={value === preset.value}
              onSelect={() => onChange(preset.value, preset.ratio)}
            >
              {size}
            </MenuOption>
          );
        })}
      </div>
    </div>
  );
}

function ResolutionColumns({ groups, value, onChange, onChooseRatio }) {
  if (!groups.length) return null;
  return (
    <div className="resolution-columns">
      {groups.map((group) => (
        <ResolutionColumn
          key={group.ratio}
          group={group}
          value={value}
          onChange={onChange}
          onChooseRatio={onChooseRatio}
        />
      ))}
    </div>
  );
}

export function ResolutionMenu({
  value,
  ratio,
  exact,
  onChange,
  onExactChange,
}) {
  const display = useDisplayResolution();
  const closeMenu = useCloseFilterMenu();
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');
  const presets = ratio
    ? RESOLUTION_PRESETS.filter((preset) => preset.ratio === ratio)
    : RESOLUTION_PRESETS;
  const groups = [];
  presets.forEach((preset) => {
    const existing = groups.find((group) => group.ratio === preset.ratio);
    if (existing) existing.items.push(preset);
    else groups.push({ ratio: preset.ratio, items: [preset] });
  });
  const placed = new Set(RESOLUTION_ROWS.flat());
  const rows = RESOLUTION_ROWS
    .map((keys) => keys.map((key) => groups.find((group) => group.ratio === key)).filter(Boolean))
    .filter((row) => row.length);
  const extras = groups.filter((group) => !placed.has(group.ratio));
  if (extras.length) rows.push(extras);
  const showDisplay = Boolean(display) && !value && !ratio;
  const isDisplayValue = display && value === display.value;
  const showAny = Boolean(value || ratio);
  const displayRatio = display?.apiRatio || '';
  const displayParts = displayRatio ? ratioParts(displayRatio) : null;

  const singleGroup = ratio && groups.length === 1 ? groups[0] : null;

  const applyCustom = (event) => {
    event.preventDefault();
    const width = Math.round(Number(customWidth));
    const height = Math.round(Number(customHeight));
    if (!width || !height || width < 100 || height < 100) return;
    const matched = closestRatio(width, height);
    onChange(`${width}x${height}`, matched || undefined);
    closeMenu();
  };

  return (
    <FilterMenu
      id="resolution"
      ariaLabel={exact ? 'Exact resolution' : 'Minimum resolution'}
      menuClassName={`filter-menu-resolution${singleGroup ? ' is-band' : ''}`}
      menuMaxHeight={640}
      trigger={(
        <>
          {value && (
            <span className={`resolution-mode-mark${exact ? ' is-exact' : ''}`}>
              {exact ? '=' : '≥'}
            </span>
          )}
          <span>{value ? value.replace('x', '×') : 'Any'}</span>
        </>
      )}
      header={(
        <div className="resolution-toolbar">
          <div className="resolution-mode" role="group" aria-label="Resolution match">
            <button
              type="button"
              className={!exact ? 'is-selected' : ''}
              aria-pressed={!exact}
              onClick={() => onExactChange(false)}
            >
              At least
            </button>
            <button
              type="button"
              className={exact ? 'is-selected' : ''}
              aria-pressed={exact}
              onClick={() => onExactChange(true)}
            >
              Exact
            </button>
          </div>
          {showDisplay && (
            <button
              type="button"
              role="option"
              aria-selected={isDisplayValue}
              className={`resolution-screen-button${isDisplayValue ? ' is-selected' : ''}`}
              onClick={() => onChange(display.value, display.apiRatio)}
            >
              <AspectShape ratio={displayRatio} box={18} />
              <span className="resolution-screen-kicker">Your screen</span>
              <span className="resolution-screen-size">{display.width}×{display.height}</span>
              {displayParts && (
                <span className="resolution-screen-note">{displayParts.ratio}</span>
              )}
            </button>
          )}
          {showAny && (
            <MenuOption className="resolution-any" selected={value === ''} onSelect={() => onChange('')}>
              Any
            </MenuOption>
          )}
        </div>
      )}
    >
      {singleGroup ? (
        <ResolutionBand group={singleGroup} value={value} onChange={onChange} />
      ) : rows.map((row) => (
        <ResolutionColumns
          key={row.map((group) => group.ratio).join('-')}
          groups={row}
          value={value}
          onChange={onChange}
          onChooseRatio={(nextRatio) => onChange('', nextRatio)}
        />
      ))}
      <form className="resolution-custom" onSubmit={applyCustom}>
        <span>Custom</span>
        <input
          type="number"
          inputMode="numeric"
          min="100"
          placeholder="Width"
          aria-label="Custom width"
          value={customWidth}
          onChange={(event) => setCustomWidth(event.target.value)}
        />
        <span aria-hidden="true">×</span>
        <input
          type="number"
          inputMode="numeric"
          min="100"
          placeholder="Height"
          aria-label="Custom height"
          value={customHeight}
          onChange={(event) => setCustomHeight(event.target.value)}
        />
        <button type="submit">Set</button>
      </form>
    </FilterMenu>
  );
}

export function SortMenu({ value, timeRange, onChange, onTimeRangeChange }) {
  const closeMenu = useCloseFilterMenu();
  const rangeLabel = TIME_RANGE_OPTIONS.find((option) => option.value === timeRange)?.label || 'Month';
  const sortValue = value === 'date_added' ? '' : value;
  const sortLabel = sortValue === 'toplist'
    ? `Top · ${rangeLabel}`
    : (SORT_OPTIONS.find((option) => option.value === sortValue)?.label || 'Latest');
  const topSelected = value === 'toplist';

  return (
    <FilterMenu
      id="sort"
      ariaLabel="Sort order"
      menuClassName="filter-menu-sort"
      menuMaxHeight={720}
      trigger={<span>{sortLabel}</span>}
      footer={(
        <div className="sort-range">
          <span className="sort-range-heading">
            <span>Top</span>
            <span>Highest rated in a time range</span>
          </span>
          <div className="sort-range-options" role="group" aria-label="Top wallpapers by time range">
            {TIME_RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={topSelected && timeRange === option.value}
                className={topSelected && timeRange === option.value ? 'is-selected' : ''}
                onClick={() => {
                  onTimeRangeChange(option.value);
                  closeMenu();
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    >
      {SORT_OPTIONS.filter((option) => option.value !== 'toplist').map((option) => (
        <MenuOption
          key={option.value || 'latest'}
          selected={sortValue === option.value}
          onSelect={() => onChange(option.value)}
        >
          <OptionCopy label={option.label} detail={SORT_DETAILS[option.value]} />
        </MenuOption>
      ))}
    </FilterMenu>
  );
}

export function ColorMenu({ value, onChange }) {
  const selected = COLOR_OPTIONS.find((option) => option.value === value);
  return (
    <FilterMenu
      id="color"
      ariaLabel="Color filter"
      menuClassName="filter-menu-colors"
      menuMaxHeight={640}
      trigger={(
        <>
          <ColorSwatch hex={selected?.hex} />
          <span>{selected?.label || 'Any'}</span>
        </>
      )}
    >
      {COLOR_OPTIONS.map((option) => (
        <MenuOption
          key={option.value || 'any'}
          selected={value === option.value}
          onSelect={() => onChange(option.value)}
        >
          <ColorSwatch hex={option.hex} />
          <OptionCopy label={option.label} />
        </MenuOption>
      ))}
    </FilterMenu>
  );
}

export function FileTypeMenu({ value, onChange }) {
  const selected = FILE_TYPE_OPTIONS.find((option) => option.value === value);
  return (
    <FilterMenu
      id="fileType"
      ariaLabel="File type filter"
      menuClassName="filter-menu-file"
      trigger={<span>{selected?.label || 'Any'}</span>}
    >
      {FILE_TYPE_OPTIONS.map((option) => (
        <MenuOption
          key={option.value || 'any'}
          selected={value === option.value}
          onSelect={() => onChange(option.value)}
        >
          <span className={`file-badge${option.value ? '' : ' is-any'}`}>
            {option.value ? option.value.toUpperCase() : 'ALL'}
          </span>
          <OptionCopy label={option.label} detail={FILE_DETAILS[option.value]} />
        </MenuOption>
      ))}
    </FilterMenu>
  );
}

export function ViewMenu({ value, onChange }) {
  const portraitPhone = usePortraitPhone();
  const selected = VIEW_OPTIONS.find((option) => option.value === value);
  const options = useMemo(() => {
    if (!portraitPhone) return VIEW_OPTIONS;
    const hidden = value === VIEW_MODES.COZY ? VIEW_MODES.COMFORTABLE : VIEW_MODES.COZY;
    return VIEW_OPTIONS.filter((option) => option.value !== hidden);
  }, [portraitPhone, value]);

  return (
    <FilterMenu
      id="viewMode"
      ariaLabel="Grid view mode"
      menuClassName="filter-menu-view"
      trigger={<span>{selected?.label || 'Comfortable'}</span>}
    >
      {options.map((option) => (
        <MenuOption
          key={option.value}
          selected={value === option.value}
          onSelect={() => onChange(option.value)}
        >
          <ViewPreview mode={option.value} portraitPhone={portraitPhone} />
          <OptionCopy label={option.label} detail={option.detail} />
        </MenuOption>
      ))}
    </FilterMenu>
  );
}
