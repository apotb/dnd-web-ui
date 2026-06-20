-- Campaign notables: NPCs and their event timelines in JSONB.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS notables_data JSONB NOT NULL DEFAULT '{"notables":[]}'::jsonb;

UPDATE public.campaigns
SET notables_data = '{
  "notables": [
    {
      "id": "wakanga-otamu",
      "name": "Wakanga O''Tamu",
      "role": "Mentioned by Kwalu",
      "portraitUrl": "https://static.wikia.nocookie.net/forgottenrealms/images/5/50/Merchant_Prince_Wakanga_O%27tamu.jpg/revision/latest?cb=20180204120606",
      "sortOrder": 0,
      "events": []
    },
    {
      "id": "syndra-silvane",
      "name": "Syndra Silvane",
      "role": "Historian of the dark arts, recently diseased",
      "portraitUrl": "https://static.wikia.nocookie.net/withweapons/images/9/9c/Syndra.jpg/revision/latest?cb=20200401000914",
      "sortOrder": 1,
      "events": []
    },
    {
      "id": "grandfather-zitembe",
      "name": "Grandfather Zitembe",
      "role": "Head priest of Temple of Savras",
      "portraitUrl": "https://static.wikia.nocookie.net/withweapons/images/0/0e/Highfather_Zitembe.jpg/revision/latest?cb=20200413032725",
      "sortOrder": 2,
      "events": []
    },
    {
      "id": "mara-tonn",
      "name": "Mara Tonn",
      "role": "Syndra Silvane''s old friend",
      "sortOrder": 3,
      "events": []
    },
    {
      "id": "daro-venn",
      "name": "Daro Venn",
      "role": "Attempted jewel thief",
      "sortOrder": 4,
      "events": []
    },
    {
      "id": "kwalu",
      "name": "Kwalu",
      "role": "Head of Silvane estate security",
      "sortOrder": 5,
      "events": []
    },
    {
      "id": "jeremiah",
      "name": "Jeremiah",
      "role": "Bartender",
      "sortOrder": 6,
      "events": []
    }
  ]
}'::jsonb
WHERE notables_data = '{"notables":[]}'::jsonb
   OR notables_data IS NULL;
