/**
 * BEACON Color Palette Reference Component
 *
 * This component displays all available colors in the design system.
 * It's useful for:
 * - Visual reference during development
 * - Testing color accessibility
 * - Presenting the palette to stakeholders
 *
 * To view: Import and render this component anywhere in your app
 * Example: <ColorPalette />
 */

export function ColorPalette() {
  const colors = [
    {
      name: 'Primary (Ocean Blue)',
      description: 'Trust, Safety, Professionalism',
      shades: [
        { name: 'Light', class: 'bg-primary-light', hex: '#7AB3F5' },
        { name: 'Default', class: 'bg-primary', hex: '#4A90E2' },
        { name: 'Dark', class: 'bg-primary-dark', hex: '#2E6CB8' },
      ],
    },
    {
      name: 'Secondary (Calm Teal)',
      description: 'Reassurance, Healing, Balance',
      shades: [
        { name: 'Light', class: 'bg-secondary-light', hex: '#7DC9BE' },
        { name: 'Default', class: 'bg-secondary', hex: '#5AB3A8' },
        { name: 'Dark', class: 'bg-secondary-dark', hex: '#3D8A81' },
      ],
    },
    {
      name: 'Alert (Gentle Coral)',
      description: 'Warm Warning, Attention without Panic',
      shades: [
        { name: 'Light', class: 'bg-alert-light', hex: '#F3AE9D' },
        { name: 'Default', class: 'bg-alert', hex: '#E88D7A' },
        { name: 'Dark', class: 'bg-alert-dark', hex: '#D16951' },
      ],
    },
    {
      name: 'Neutral (Gray Scale)',
      description: 'Calm, Professional, Unobtrusive',
      shades: [
        { name: '50', class: 'bg-neutral-50', hex: '#F8F9FA' },
        { name: '100', class: 'bg-neutral-100', hex: '#E9ECEF' },
        { name: '200', class: 'bg-neutral-200', hex: '#DEE2E6' },
        { name: '300', class: 'bg-neutral-300', hex: '#CED4DA' },
        { name: '400', class: 'bg-neutral-400', hex: '#ADB5BD' },
        { name: '500', class: 'bg-neutral-500', hex: '#6C757D' },
        { name: '600', class: 'bg-neutral-600', hex: '#495057' },
        { name: '700', class: 'bg-neutral-700', hex: '#343A40' },
        { name: '800', class: 'bg-neutral-800', hex: '#212529' },
        { name: '900', class: 'bg-neutral-900', hex: '#0F1419' },
      ],
    },
  ];

  return (
    <div className="p-8 bg-neutral-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-neutral-900 mb-2">
          BEACON Color Palette
        </h1>
        <p className="text-neutral-600 mb-8">
          A calming, safe, and trustworthy palette for emergency response
        </p>

        <div className="space-y-8">
          {colors.map((colorGroup) => (
            <div
              key={colorGroup.name}
              className="bg-white rounded-lg shadow-md p-6 border border-neutral-200"
            >
              <h2 className="text-2xl font-semibold text-neutral-800 mb-1">
                {colorGroup.name}
              </h2>
              <p className="text-neutral-500 mb-4">{colorGroup.description}</p>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {colorGroup.shades.map((shade) => (
                  <div key={shade.name} className="space-y-2">
                    <div
                      className={`${shade.class} h-24 rounded-lg border-2 border-neutral-300 shadow-sm`}
                    />
                    <div className="text-sm">
                      <p className="font-semibold text-neutral-700">
                        {shade.name}
                      </p>
                      <p className="text-neutral-500 font-mono text-xs">
                        {shade.hex}
                      </p>
                      <p className="text-neutral-400 font-mono text-xs">
                        {shade.class}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-white rounded-lg shadow-md p-6 border border-neutral-200">
          <h2 className="text-2xl font-semibold text-neutral-800 mb-4">
            Usage Examples
          </h2>

          <div className="space-y-6">
            {/* Buttons */}
            <div>
              <h3 className="text-lg font-semibold text-neutral-700 mb-3">
                Buttons
              </h3>
              <div className="flex flex-wrap gap-3">
                <button className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
                  Primary Button
                </button>
                <button className="px-6 py-3 bg-secondary text-white rounded-lg hover:bg-secondary-dark transition-colors">
                  Secondary Button
                </button>
                <button className="px-6 py-3 bg-alert text-white rounded-lg hover:bg-alert-dark transition-colors">
                  Alert Button
                </button>
                <button className="px-6 py-3 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 transition-colors">
                  Neutral Button
                </button>
              </div>
            </div>

            {/* Badges */}
            <div>
              <h3 className="text-lg font-semibold text-neutral-700 mb-3">
                Status Badges
              </h3>
              <div className="flex flex-wrap gap-3">
                <span className="px-4 py-2 bg-primary text-white rounded-full text-sm font-medium">
                  In Progress
                </span>
                <span className="px-4 py-2 bg-secondary text-white rounded-full text-sm font-medium">
                  Resolved
                </span>
                <span className="px-4 py-2 bg-alert text-white rounded-full text-sm font-medium">
                  Needs Attention
                </span>
                <span className="px-4 py-2 bg-neutral-300 text-neutral-700 rounded-full text-sm font-medium">
                  Pending
                </span>
              </div>
            </div>

            {/* Alerts */}
            <div>
              <h3 className="text-lg font-semibold text-neutral-700 mb-3">
                Alert Messages
              </h3>
              <div className="space-y-3">
                <div className="p-4 bg-primary/10 border-l-4 border-primary rounded">
                  <p className="text-primary-dark font-medium">
                    Information: Your request has been received
                  </p>
                </div>
                <div className="p-4 bg-secondary/10 border-l-4 border-secondary rounded">
                  <p className="text-secondary-dark font-medium">
                    Success: Help is on the way!
                  </p>
                </div>
                <div className="p-4 bg-alert/10 border-l-4 border-alert rounded">
                  <p className="text-alert-dark font-medium">
                    Warning: Please provide more details
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-neutral-500 text-sm">
          <p>
            See <code className="bg-neutral-200 px-2 py-1 rounded">COLORS.md</code>{' '}
            for complete usage guidelines
          </p>
        </div>
      </div>
    </div>
  );
}
