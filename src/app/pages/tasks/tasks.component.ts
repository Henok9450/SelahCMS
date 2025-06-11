import { Component, OnInit, OnDestroy } from '@angular/core';
import { Task } from '../../../app/core/tasks.model';
import { TasksService } from '../../../app/core/tasks.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Subscription } from 'rxjs';
import firebase from 'firebase/compat/app';
import { convertToDate } from '../../pages/Utility/date.utils';

@Component({
  selector: 'app-tasks',
  templateUrl: './tasks.component.html',
  styleUrls: ['./tasks.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class TasksComponent implements OnInit, OnDestroy {
  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  showCreateForm = false;
  pendingCount: number = 0;
  completedCount: number = 0;
  isLoading = true;
  
  newTask: Partial<Task> = {
    title: '',
    description: '',
    status: 'pending',
    dueDate: new Date()
  };

  convertToDate = convertToDate;

  // Filter options
  currentFilter: 'all' | 'pending' | 'completed' = 'all';
  private subscriptions: Subscription[] = [];

  constructor(private tasksService: TasksService) {}

  ngOnInit() {
    this.loadTasks();
  }

  updateCounters() {
    this.pendingCount = this.tasks.filter(task => task.status === 'pending').length;
    this.completedCount = this.tasks.filter(task => task.status === 'completed').length;
  }

  async loadTasks() {
    try {
      const tasks = await firstValueFrom(this.tasksService.getTasks());
      console.log('Received tasks:', tasks); // Debug log
      
      this.tasks = tasks;
      this.updateCounters();
      this.filterTasks(this.currentFilter);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      this.isLoading = false;
    }
  }
  toggleCreateForm() {
    this.showCreateForm = !this.showCreateForm;
    if (!this.showCreateForm) {
      this.resetForm();
    }
  }

  resetForm() {
    this.newTask = {
      title: '',
      description: '',
      status: 'pending',
      dueDate: new Date()
    };
  }

  async createTask() {
    if (!this.newTask.title) return;

    try {
      await this.tasksService.createTask({
        ...this.newTask,
        dueDate: this.newTask.dueDate || new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
      } as Task);
      
      this.resetForm();
      this.showCreateForm = false;
      await this.loadTasks();
    } catch (error) {
      console.error('Error creating task:', error);
    }
  }

  filterTasks(filter: 'all' | 'pending' | 'completed') {
    this.currentFilter = filter;
    this.filteredTasks = filter === 'all'
      ? [...this.tasks]
      : this.tasks.filter(task => task.status === filter);
  }

  async updateTaskStatus(task: Task, newStatus: 'pending' | 'completed') {
    if (!task.id) {
      console.error('Task ID is undefined. Cannot update task status.');
      return;
    }
  
    try {
      await this.tasksService.updateTask(task.id, { status: newStatus });
      await this.loadTasks();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  }
  
  async deleteTask(taskId: string | undefined) {
    if (!taskId) {
      console.error('Task ID is undefined. Cannot delete task.');
      return;
    }
  
    try {
      await this.tasksService.deleteTask(taskId);
      await this.loadTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}