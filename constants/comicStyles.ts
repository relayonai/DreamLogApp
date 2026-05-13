export const COMIC_STYLE_LABELS: Record<string, string> = {
  classic: 'Classic Comic',
  graphic_novel: 'Graphic Novel',
  manga: 'Manga',
  surreal: 'Dreamy / Surreal',
};

export interface PanelConfig {
  borderWidth: number;
  borderColor: string;
  backgroundColor: string;
  captionBg: string;
  captionTextColor: string;
}

export const PANEL_CONFIG: Record<string, PanelConfig> = {
  classic:       { borderWidth: 3, borderColor: '#000',         backgroundColor: '#fff',    captionBg: '#fff8dc',              captionTextColor: '#000' },
  graphic_novel: { borderWidth: 1, borderColor: '#222',         backgroundColor: '#111',    captionBg: 'rgba(0,0,0,0.75)',     captionTextColor: '#eee' },
  manga:         { borderWidth: 2, borderColor: '#000',         backgroundColor: '#fff',    captionBg: '#fff',                 captionTextColor: '#000' },
  surreal:       { borderWidth: 0, borderColor: 'transparent',  backgroundColor: '#1a0a2e', captionBg: 'rgba(108,99,255,0.3)', captionTextColor: '#e0d0ff' },
};
