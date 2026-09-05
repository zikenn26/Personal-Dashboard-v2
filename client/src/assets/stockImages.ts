// Central registry of locally stored stock images used across the application as default mock data assets.
import avatarImg from './images/avatar_profile_default_1787908073095.jpg';
import workspaceImg from './images/hero_workspace_cover_1787908054686.jpg';
import mountainsImg from './images/mountain_nature_cover_1787908099016.jpg';
import bambooImg from './images/zen_bamboo_garden_1787908116834.jpg';
import architectureImg from './images/minimal_architecture_1787908133593.jpg';

export const STOCK_IMAGES = {
  avatar: avatarImg,
  workspaceCover: workspaceImg,
  mountainsCover: mountainsImg,
  bambooGardenCover: bambooImg,
  architectureCover: architectureImg,
};

export interface LocalStockItem {
  id: string;
  name: string;
  url: string;
  category: 'workspace' | 'nature' | 'architecture' | 'aesthetic' | 'village';
  tag: string;
  aspectRatio: string;
}

export const LOCAL_STOCK_GALLERY: LocalStockItem[] = [
  {
    id: 'local-stock-workspace',
    name: 'Modern Minimalist Workspace',
    url: workspaceImg,
    category: 'workspace',
    tag: 'Workspace & Desk',
    aspectRatio: '16:9',
  },
  {
    id: 'local-stock-mountains',
    name: 'Alpine Sunrise & Dawn Valley',
    url: mountainsImg,
    category: 'nature',
    tag: 'Nature & Mountains',
    aspectRatio: '16:9',
  },
  {
    id: 'local-stock-bamboo',
    name: 'Zen Bamboo Garden & Stepping Stones',
    url: bambooImg,
    category: 'nature',
    tag: 'Zen Garden',
    aspectRatio: '16:9',
  },
  {
    id: 'local-stock-arch',
    name: 'Clean Travertine Architectural Pavilion',
    url: architectureImg,
    category: 'architecture',
    tag: 'Minimalism',
    aspectRatio: '16:9',
  },
];
