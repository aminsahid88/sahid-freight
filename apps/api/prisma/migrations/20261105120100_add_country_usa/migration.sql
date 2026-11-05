-- The carrier back office signs up US carriers (sends country "USA").
ALTER TYPE "Country" ADD VALUE IF NOT EXISTS 'USA';
