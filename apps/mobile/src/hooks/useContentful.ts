import { useCallback } from 'react';
import { getAllYouTubeVideosInfo, formatYouTubeVideosForApp } from '../config/videos';

export interface AssetItem {
  title: string;
  url: string;
  description?: string;
  contentType?: string;
  fileName?: string;
  youtubeId?: string;
  thumbnail?: string;
  isYouTube?: boolean;
  isContentful?: boolean;
  category?: string;
  tags?: string[];
  duration?: string;
  viewCount?: number;
  publishedAt?: string;
  authorName?: string;
}

interface RichTextContent {
  json: any;
  header?: string;
}

const SPACE_ID = 'o75w8kum651h';
const ENV = 'master';
const API_URL = `https://graphql.contentful.com/content/v1/spaces/${SPACE_ID}/environments/${ENV}`;
const TOKEN = 'opiyJiFYSAxQchyAT3xBIx50xRqWB2wzkjLNzsMKRjA';

export default function useContentful() {
  const getClientVideos = useCallback(async (): Promise<AssetItem[]> => {
    try {
      if (__DEV__) {
        console.log('📹 [Videos] Récupération des vidéos YouTube...');
      }
      
      // Récupérer les informations YouTube automatiquement depuis les URLs
      const youtubeVideosInfo = await getAllYouTubeVideosInfo();
      const youtubeVideos = formatYouTubeVideosForApp(youtubeVideosInfo) as AssetItem[];
      
      if (__DEV__) {
        console.log('📹 [Videos]', youtubeVideos.length, 'vidéos YouTube récupérées');
      }
      
      return youtubeVideos;
    } catch (error) {
      console.error('❌ [Videos] Erreur lors de la récupération des vidéos:', error);
      return [];
    }
  }, []);

  const getRichText = useCallback(async (id: string): Promise<RichTextContent | null> => {
    try {
      const query = `
        query($id: String!) {
          paragraph(id: $id) {
            header
            paragraphs {
              json
            }
          }
        }
      `;

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TOKEN}`,
        },
        body: JSON.stringify({ query, variables: { id } }),
      });

      if (!res.ok) {
        return null;
      }

      const json = await res.json();
      
      if (json.errors) {
        return null;
      }

      return json?.data?.paragraph || null;
    } catch (error) {
      return null;
    }
  }, []);

  return { getClientVideos, getRichText };
}




