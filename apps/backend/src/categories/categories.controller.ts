import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { Public } from '../auth/public.decorator';
import { CategoriesService } from './categories.service';

interface RequestWithUser extends Request {
  user: any;
}

export interface CreateCategoryDto {
  name: string;
  description: string;
  status?: 'draft' | 'active';
}

export interface UpdateCategoryDto {
  name?: string;
  description?: string;
  status?: 'draft' | 'active';
}

@ApiTags('categories')
@Controller('categories')
@ApiBearerAuth()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all categories (Public)' })
  @ApiResponse({
    status: 200,
    description: 'List of categories retrieved successfully',
  })
  async getAllCategories(
    @Query('search') search?: string,
    @Query('status') status?: string
  ) {
    try {
      const categories = await this.categoriesService.getAllCategories(
        search,
        status
      );
      return {
        success: true,
        data: categories,
        message: 'Categories retrieved successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to retrieve categories',
          error: error.message || 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get category by ID (Public)' })
  @ApiResponse({
    status: 200,
    description: 'Category retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Category not found',
  })
  async getCategoryById(@Param('id') id: string) {
    try {
      const category = await this.categoriesService.getCategoryById(id);
      if (!category) {
        throw new HttpException(
          {
            success: false,
            message: 'Category not found',
          },
          HttpStatus.NOT_FOUND
        );
      }
      return {
        success: true,
        data: category,
        message: 'Category retrieved successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Failed to retrieve category',
          error: error.message || 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post()
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Create a new category (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Category created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid data',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin privileges required',
  })
  async createCategory(
    @Body() createCategoryDto: CreateCategoryDto,
    @Req() request: RequestWithUser
  ) {
    try {
      const category = await this.categoriesService.createCategory(
        createCategoryDto
      );
      return {
        success: true,
        data: category,
        message: 'Category created successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to create category',
          error: error.message || 'Unknown error',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Put(':id')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Update a category (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Category updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Category not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin privileges required',
  })
  async updateCategory(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @Req() request: RequestWithUser
  ) {
    try {
      const category = await this.categoriesService.updateCategory(
        id,
        updateCategoryDto
      );
      if (!category) {
        throw new HttpException(
          {
            success: false,
            message: 'Category not found',
          },
          HttpStatus.NOT_FOUND
        );
      }
      return {
        success: true,
        data: category,
        message: 'Category updated successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Failed to update category',
          error: error.message || 'Unknown error',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Delete(':id')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Delete a category (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Category deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Category not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin privileges required',
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - Category cannot be deleted (has associated subcategories)',
  })
  async deleteCategory(
    @Param('id') id: string,
    @Req() request: RequestWithUser
  ) {
    try {
      const result = await this.categoriesService.deleteCategory(id);
      if (!result) {
        throw new HttpException(
          {
            success: false,
            message: 'Category not found',
          },
          HttpStatus.NOT_FOUND
        );
      }
      return {
        success: true,
        message: 'Category deleted successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Failed to delete category',
          error: error.message || 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
