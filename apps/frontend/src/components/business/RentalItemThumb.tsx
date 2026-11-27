import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import HandymanOutlinedIcon from '@mui/icons-material/HandymanOutlined';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import { Box } from '@mui/material';
import { useState } from 'react';

export interface RentalItemThumbItem {
  name: string;
  rental_category?: { name?: string | null } | null;
  rental_item_images?: Array<{
    display_url?: string | null;
    thumbnail?: string | null;
    image_url?: string | null;
  }>;
}

function categoryIcon(name: string) {
  if (/camera|photo|caméra|appareil/i.test(name)) return PhotoCameraOutlinedIcon;
  if (/equipment|équipement|equipement|tool|outil|light/i.test(name)) return HandymanOutlinedIcon;
  if (/power|électr|electr|éclair/i.test(name)) return BoltOutlinedIcon;
  return CategoryOutlinedIcon;
}

export function RentalItemThumb({ item }: { item: RentalItemThumbItem }) {
  const image = item.rental_item_images?.[0];
  const url = image?.display_url || image?.thumbnail || image?.image_url || null;
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      <Box
        component="img"
        src={url}
        alt=""
        onError={() => setFailed(true)}
        sx={{ width: 56, height: 56, borderRadius: 1.5, objectFit: 'cover', flexShrink: 0, bgcolor: 'action.hover' }}
      />
    );
  }
  const Icon = categoryIcon(item.rental_category?.name || item.name);
  return (
    <Box sx={{ width: 56, height: 56, borderRadius: 1.5, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon color="action" />
    </Box>
  );
}
