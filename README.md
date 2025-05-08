# Hindi-Color-Names

A collection of Hindi color names with their corresponding hex values.

## Call for Help

I am the least qualified person to run this repository. 
I am not a native Hindi speaker: 
If you are a native Hindi speaker and you want to help me, please open an issue or a pull request.

I am more than happy to transfer the ownership of this repository to you if you are willing to maintain it.

## List of Color Names 🔖 (**252**)

![List of all Color Names](colors.svg "List of Hindi color names")

You can also view the colors as an [interactive HTML page](colors.html).

## How It Works

This collection is built by scraping color names from Hindi language sources, primarily Wikipedia. The process:

1. Fetches color names and hex values from defined sources
2. Sanitizes the data (removing duplicates, formatting hex values)
3. Generates visualization files (SVG, HTML)
4. Outputs data in multiple formats (JSON, CSV)

## Building the List

1. Clone the repository
2. Install the dependencies: `npm ci`
3. Run the build script:
   
```bash
npm run build
```

## Output Files

The build process generates:

- `colors.json` - Full JSON with color data
- `colors.min.json` - Minified JSON version
- `colors.csv` - CSV format with name, hex value, and source link
- `colors.svg` - Visual representation of all colors
- `colors.html` - Interactive HTML page with clickable color names

## Contributing

To add your own color entries, edit the `src/userCreations.csv` file with the format:

```csv
name,hex,link
```

Then run the build script to regenerate all files.
