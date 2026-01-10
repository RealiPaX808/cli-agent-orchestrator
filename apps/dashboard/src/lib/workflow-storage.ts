import { Workflow, WorkflowPattern } from '@/types/workflow';
import { caoClient } from './api-client';

const PATTERNS_KEY = 'cao_workflow_patterns';

export class WorkflowStorage {
  static async getWorkflows(): Promise<Workflow[]> {
    try {
      return await caoClient.listWorkflows();
    } catch (error) {
      console.error('Failed to load workflows:', error);
      return [];
    }
  }

  static async getWorkflow(id: string): Promise<Workflow | null> {
    try {
      return await caoClient.getWorkflow(id);
    } catch (error) {
      console.error('Failed to load workflow:', error);
      return null;
    }
  }

  static async saveWorkflow(workflow: Workflow): Promise<void> {
    try {
      const workflows = await this.getWorkflows();
      const existing = workflows.find(w => w.id === workflow.id);
      
      const updatedWorkflow = {
        ...workflow,
        updatedAt: new Date().toISOString(),
      };

      if (existing) {
        await caoClient.updateWorkflow(workflow.id, updatedWorkflow);
      } else {
        await caoClient.createWorkflow(updatedWorkflow);
      }
    } catch (error) {
      console.error('Failed to save workflow:', error);
      throw error;
    }
  }

  static async deleteWorkflow(id: string): Promise<void> {
    try {
      await caoClient.deleteWorkflow(id);
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      throw error;
    }
  }

  static exportWorkflow(workflow: Workflow): string {
    return JSON.stringify(workflow, null, 2);
  }

  static async importWorkflow(json: string): Promise<Workflow> {
    const workflow = JSON.parse(json) as Workflow;
    
    const importedWorkflow = {
      ...workflow,
      id: `workflow-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await this.saveWorkflow(importedWorkflow);
    return importedWorkflow;
  }

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

  static deletePattern(id: string): void {
    const patterns = this.getPatterns();
    const filtered = patterns.filter(p => p.id !== id);
    localStorage.setItem(PATTERNS_KEY, JSON.stringify(filtered));
  }

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
