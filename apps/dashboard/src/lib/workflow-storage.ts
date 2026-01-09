import { Workflow, WorkflowPattern } from '@/types/workflow';

const WORKFLOWS_KEY = 'cao_workflows';
const PATTERNS_KEY = 'cao_workflow_patterns';

/**
 * Workflow Storage Service
 * Handles persistence of workflows and patterns to localStorage
 */

export class WorkflowStorage {
  /**
   * Get all workflows
   */
  static getWorkflows(): Workflow[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const data = localStorage.getItem(WORKFLOWS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to load workflows:', error);
      return [];
    }
  }

  /**
   * Get workflow by ID
   */
  static getWorkflow(id: string): Workflow | null {
    const workflows = this.getWorkflows();
    return workflows.find(w => w.id === id) || null;
  }

  /**
   * Save workflow
   */
  static saveWorkflow(workflow: Workflow): void {
    const workflows = this.getWorkflows();
    const existingIndex = workflows.findIndex(w => w.id === workflow.id);
    
    const updatedWorkflow = {
      ...workflow,
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      workflows[existingIndex] = updatedWorkflow;
    } else {
      workflows.push(updatedWorkflow);
    }

    localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows));
  }

  /**
   * Delete workflow
   */
  static deleteWorkflow(id: string): void {
    const workflows = this.getWorkflows();
    const filtered = workflows.filter(w => w.id !== id);
    localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(filtered));
  }

  /**
   * Export workflow to JSON
   */
  static exportWorkflow(workflow: Workflow): string {
    return JSON.stringify(workflow, null, 2);
  }

  /**
   * Import workflow from JSON
   */
  static importWorkflow(json: string): Workflow {
    const workflow = JSON.parse(json) as Workflow;
    
    // Assign new ID and timestamps on import
    return {
      ...workflow,
      id: `workflow-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get all workflow patterns
   */
  static getPatterns(): WorkflowPattern[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const data = localStorage.getItem(PATTERNS_KEY);
      return data ? JSON.parse(data) : this.getDefaultPatterns();
    } catch (error) {
      console.error('Failed to load patterns:', error);
      return this.getDefaultPatterns();
    }
  }

  /**
   * Save workflow pattern
   */
  static savePattern(pattern: WorkflowPattern): void {
    const patterns = this.getPatterns();
    const existingIndex = patterns.findIndex(p => p.id === pattern.id);

    if (existingIndex >= 0) {
      patterns[existingIndex] = pattern;
    } else {
      patterns.push(pattern);
    }

    localStorage.setItem(PATTERNS_KEY, JSON.stringify(patterns));
  }

  /**
   * Delete workflow pattern
   */
  static deletePattern(id: string): void {
    const patterns = this.getPatterns();
    const filtered = patterns.filter(p => p.id !== id);
    localStorage.setItem(PATTERNS_KEY, JSON.stringify(filtered));
  }

  /**
   * Create workflow from pattern
   */
  static createFromPattern(patternId: string): Workflow | null {
    const pattern = this.getPatterns().find(p => p.id === patternId);
    if (!pattern) return null;

    return {
      ...pattern.workflow,
      id: `workflow-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Default workflow patterns
   */
  private static getDefaultPatterns(): WorkflowPattern[] {
    return [
      {
        id: 'pattern-sequential-review',
        name: 'Sequential Code Review',
        description: 'Developer writes code, reviewer checks it, tester validates',
        category: 'Development',
        tags: ['code-review', 'quality', 'sequential'],
        workflow: {
          name: 'Sequential Code Review',
          description: 'Standard code review workflow',
          nodes: [],
          edges: [],
          config: {
            errorHandling: 'stop',
          },
        },
      },
      {
        id: 'pattern-parallel-analysis',
        name: 'Parallel Data Analysis',
        description: 'Multiple agents analyze different data sources in parallel',
        category: 'Data',
        tags: ['parallel', 'analysis', 'data'],
        workflow: {
          name: 'Parallel Data Analysis',
          description: 'Analyze multiple data sources simultaneously',
          nodes: [],
          edges: [],
          config: {
            parallelExecution: true,
            maxParallelNodes: 4,
            errorHandling: 'continue',
          },
        },
      },
    ];
  }
}
