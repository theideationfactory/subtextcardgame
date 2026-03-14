# Background Gradient Feature Setup

## Database Migration Required

The background gradient selector feature has been implemented, but requires a database column to be added.

### Steps to Enable the Feature:

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Navigate to your project
   - Go to the SQL Editor

2. **Run the Migration**
   - Copy the contents of `ADD_BACKGROUND_GRADIENT_COLUMN.sql`
   - Paste it into the SQL Editor
   - Click "Run" to execute the migration

3. **Verify the Migration**
   - The script will show a verification query result
   - You should see the `background_gradient` column listed with type `text` and default value `["#6366f1","#8b5cf6"]`

### What This Adds:

- `background_gradient` column to the `cards` table
- Default value: Purple Mystic gradient `["#6366f1","#8b5cf6"]`
- GIN index for potential future queries
- Proper column documentation

### After Migration:

Once the migration is complete, the background gradient selector will work perfectly:

- ✅ 4 beautiful gradient options in the card creation screen
- ✅ Visual gradient previews with selection states
- ✅ Proper database storage and retrieval
- ✅ Support for both new cards and editing existing cards

### Gradient Options Available:

1. **Purple Mystic**: `["#6366f1","#8b5cf6"]` (default)
2. **Ocean Depths**: `["#0ea5e9","#06b6d4"]`
3. **Sunset Glow**: `["#f59e0b","#ef4444"]`
4. **Forest Magic**: `["#10b981","#059669"]`

The feature is positioned between the Context dropdown and Visibility settings as requested.
