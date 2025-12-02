import os
import csv
import sys

def main():
    # Get CSV filename from command line argument, default to 'openmoji.csv'
    csv_filename = sys.argv[1] if len(sys.argv) > 1 else 'openmoji.csv'
    
    # Directory containing the SVG files (current directory)
    svg_dir = '.'
    
    print(f"Debug: Looking for CSV file: {csv_filename}")
    print(f"Debug: SVG directory: {svg_dir}")
    
    # Check if CSV file exists
    if not os.path.exists(csv_filename):
        print(f"Error: CSV file '{csv_filename}' not found.")
        return
    
    print(f"Debug: CSV file exists: {csv_filename}")
    
    # Check if directory exists
    if not os.path.exists(svg_dir):
        print(f"Error: Directory '{svg_dir}' not found.")
        return
    
    print(f"Debug: Directory exists: {svg_dir}")
    
    # List SVG files
    svg_files = [f for f in os.listdir(svg_dir) if f.endswith('.svg')]
    print(f"Debug: Found {len(svg_files)} SVG files")
    
    if not svg_files:
        print("No SVG files found in the directory.")
        return
    
    # Read the mapping from CSV file
    try:
        with open(csv_filename, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            print(f"Debug: CSV column names: {reader.fieldnames}")
            
            # Check if required columns exist
            if not reader.fieldnames or 'hexcode' not in reader.fieldnames or 'annotation' not in reader.fieldnames:
                print(f"Error: CSV file must contain 'hexcode' and 'annotation' columns. Found: {reader.fieldnames}")
                return
            
            print("Debug: CSV columns verified successfully")
            
            # Create hexcode to annotation mapping
            hexcode_to_annotation = {}
            for row in reader:
                hexcode = row['hexcode'].upper()
                annotation = row['annotation']
                # Clean up annotation for filename
                clean_annotation = annotation.lower().replace(' ', '_').replace('-', '_')
                # Remove any characters that might be problematic in filenames
                clean_annotation = ''.join(c for c in clean_annotation if c.isalnum() or c == '_')
                hexcode_to_annotation[hexcode] = clean_annotation
            
            print(f"Debug: Created mapping for {len(hexcode_to_annotation)} items")
    
    except Exception as e:
        print(f"Error reading CSV file: {e}")
        return
    
    # Rename SVG files
    renamed_count = 0
    for svg_file in svg_files:
        # Extract hexcode from filename (remove .svg extension)
        filename_no_ext = svg_file[:-4]  # Remove .svg
        hexcode = filename_no_ext.upper()
        
        if hexcode in hexcode_to_annotation:
            new_filename = f"{hexcode_to_annotation[hexcode]}.svg"
            old_path = os.path.join(svg_dir, svg_file)
            new_path = os.path.join(svg_dir, new_filename)
            
            try:
                os.rename(old_path, new_path)
                print(f"Renamed: {svg_file} -> {new_filename}")
                renamed_count += 1
            except OSError as e:
                print(f"Error renaming {svg_file}: {e}")
        else:
            print(f"No mapping found for hexcode: {hexcode} (file: {svg_file})")
    
    print(f"\nRenaming complete! {renamed_count} files renamed successfully.")

if __name__ == "__main__":
    main()
