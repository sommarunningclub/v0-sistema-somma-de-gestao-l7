-- Add tag column to professor_clients table
ALTER TABLE professor_clients
ADD COLUMN tag TEXT DEFAULT 'alunoprofessor';

-- Create an enum type for common tags (optional, for better type safety)
-- ALTER TYPE professor_client_tag AS ENUM ('alunoprofessor', 'alunosomma');

-- Add index for faster filtering by tag
CREATE INDEX idx_professor_clients_tag ON professor_clients(tag);
