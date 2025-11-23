-- Migration: Add 'familiar' to clasificacion constraint
-- Date: 2025-11-23
-- Description: Extends the clasificacion CHECK constraint to include 'familiar' value

-- Drop the existing constraint
ALTER TABLE agent_memory
DROP CONSTRAINT IF EXISTS agent_memory_clasificacion_check;

-- Add the new constraint with 'familiar' included
ALTER TABLE agent_memory
ADD CONSTRAINT agent_memory_clasificacion_check
CHECK (clasificacion IN ('tarea', 'compra', 'pensamiento', 'otro', 'familiar'));

-- Verify the constraint was added
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'agent_memory'::regclass
AND conname = 'agent_memory_clasificacion_check';
