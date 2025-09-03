import React from 'react';
import { ExcelTask, excelParser } from '../services/excelParser';

interface ExcelShortcutsProps {
  theme?: 'light' | 'dark';
  onShortcutClick: (task: ExcelTask) => void;
  disabled?: boolean;
}

interface ExcelShortcut {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  command: string;
  category: 'data' | 'formatting' | 'analysis' | 'charts';
}

const shortcuts: ExcelShortcut[] = [
  {
    id: 'create_chart',
    title: 'Create Chart',
    description: 'Generate a chart from selected data',
    command: 'Create a chart from the selected data',
    category: 'charts',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )
  },
  {
    id: 'format_table',
    title: 'Format Table',
    description: 'Apply professional table formatting',
    command: 'Format the selected range as a professional table',
    category: 'formatting',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    id: 'create_pivot',
    title: 'Pivot Table',
    description: 'Create a pivot table for data analysis',
    command: 'Create a pivot table from the selected data',
    category: 'analysis',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    )
  },
  {
    id: 'sum_formula',
    title: 'Sum Formula',
    description: 'Add SUM formula to selected cells',
    command: 'Add a SUM formula for the selected range',
    category: 'data',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
      </svg>
    )
  },
  {
    id: 'conditional_format',
    title: 'Conditional Format',
    description: 'Apply conditional formatting rules',
    command: 'Apply conditional formatting to highlight important values',
    category: 'formatting',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    )
  },
  {
    id: 'data_validation',
    title: 'Data Validation',
    description: 'Set up data validation rules',
    command: 'Add data validation rules to ensure data quality',
    category: 'data',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    id: 'sort_data',
    title: 'Sort Data',
    description: 'Sort selected data range',
    command: 'Sort the selected data in ascending order',
    category: 'data',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
      </svg>
    )
  },
  {
    id: 'filter_data',
    title: 'Add Filters',
    description: 'Add filter dropdowns to data',
    command: 'Add auto filters to the selected data range',
    category: 'data',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
      </svg>
    )
  }
];

const categoryNames = {
  data: 'Data Operations',
  formatting: 'Formatting',
  analysis: 'Analysis',
  charts: 'Charts & Visuals'
};

const categoryColors = {
  data: 'bg-blue-500/10 text-blue-600 border-blue-200',
  formatting: 'bg-purple-500/10 text-purple-600 border-purple-200',
  analysis: 'bg-green-500/10 text-green-600 border-green-200',
  charts: 'bg-orange-500/10 text-orange-600 border-orange-200'
};

export const ExcelShortcuts: React.FC<ExcelShortcutsProps> = ({
  theme = 'dark',
  onShortcutClick,
  disabled = false
}) => {
  const handleShortcutClick = (shortcut: ExcelShortcut) => {
    if (disabled) return;

    // Parse the shortcut command into an ExcelTask
    const parseResult = excelParser.parse(shortcut.command);
    
    if (parseResult.success && parseResult.task) {
      // Use the parsed task
      onShortcutClick(parseResult.task);
    } else {
      // Create a fallback task
      const fallbackTask: ExcelTask = {
        id: `shortcut_${shortcut.id}_${Date.now()}`,
        type: shortcut.id as any,
        description: shortcut.command,
        complexity: 'simple',
        estimatedActions: 5,
        parameters: {},
        mode: 'visual',
        priority: 2,
        status: 'pending',
        steps: [
          {
            id: '1',
            action: 'copy_paste',
            description: shortcut.command,
            parameters: {},
            order: 1,
            estimatedTime: 10
          }
        ],
        metadata: {
          createdAt: new Date(),
          estimatedDuration: 10
        }
      };
      onShortcutClick(fallbackTask);
    }
  };

  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((groups, shortcut) => {
    if (!groups[shortcut.category]) {
      groups[shortcut.category] = [];
    }
    groups[shortcut.category].push(shortcut);
    return groups;
  }, {} as Record<string, ExcelShortcut[]>);

  return (
    <div className={`excel-shortcuts p-4 space-y-4 ${ 
      theme === 'dark' ? 'text-white' : 'text-surface-900'
    }`}>
      <div className="flex items-center justify-between">
        <h3 className={`font-semibold text-lg ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
          Excel Quick Actions
        </h3>
        <div className={`text-xs px-2 py-1 rounded ${
          disabled 
            ? 'bg-red-500/10 text-red-500' 
            : 'bg-green-500/10 text-green-500'
        }`}>
          {disabled ? 'Unavailable' : 'Ready'}
        </div>
      </div>

      {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
        <div key={category} className="space-y-2">
          <h4 className={`text-sm font-medium uppercase tracking-wide ${
            theme === 'dark' ? 'text-surface-400' : 'text-surface-600'
          }`}>
            {categoryNames[category as keyof typeof categoryNames]}
          </h4>
          
          <div className="grid grid-cols-2 gap-2">
            {categoryShortcuts.map((shortcut) => (
              <button
                key={shortcut.id}
                onClick={() => handleShortcutClick(shortcut)}
                disabled={disabled}
                className={`
                  group p-3 rounded-lg border text-left transition-all duration-200
                  ${disabled 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:scale-105 hover:shadow-lg active:scale-95'
                  }
                  ${theme === 'dark'
                    ? `bg-surface-800/50 border-surface-700 hover:bg-surface-700/50 ${
                        categoryColors[shortcut.category]?.replace(/bg-\w+-500\/10 text-\w+-600 border-\w+-200/, 
                        'hover:bg-surface-700 hover:border-surface-600')
                      }`
                    : `bg-white border-surface-200 hover:border-surface-300 shadow-sm ${categoryColors[shortcut.category]}`
                  }
                `}
                title={shortcut.description}
              >
                <div className="flex items-start space-x-3">
                  <div className={`
                    p-2 rounded-lg shrink-0
                    ${theme === 'dark' 
                      ? 'bg-surface-700 group-hover:bg-surface-600' 
                      : categoryColors[shortcut.category]
                    }
                  `}>
                    {shortcut.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className={`font-medium text-sm truncate ${
                      theme === 'dark' ? 'text-white' : 'text-surface-900'
                    }`}>
                      {shortcut.title}
                    </h5>
                    <p className={`text-xs mt-1 line-clamp-2 ${
                      theme === 'dark' ? 'text-surface-400' : 'text-surface-600'
                    }`}>
                      {shortcut.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Quick tip */}
      <div className={`
        text-xs p-3 rounded border-l-4 border-blue-500
        ${theme === 'dark' 
          ? 'bg-blue-500/10 text-blue-300' 
          : 'bg-blue-50 text-blue-700'
        }
      `}>
        💡 <strong>Tip:</strong> These shortcuts work with your current Excel selection. 
        Select data first, then click a shortcut for best results.
      </div>
    </div>
  );
};

export default ExcelShortcuts;