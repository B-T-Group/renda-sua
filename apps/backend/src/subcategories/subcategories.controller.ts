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
import { SubcategoriesService } from './subcategories.service';

interface RequestWithUser extends Request {
  user: any;
}

export interface CreateSubcategoryDto {
  name: string;
  description: string;
  item_category_id: number;
  status?: 'draft' | 'active';
}

export interface UpdateSubcategoryDto {
  name?: string;
  description?: string;
  item_category_id?: number;
  status?: 'draft' | 'active';
}

@ApiTags('subcategories')
@Controller('subcategories')
@ApiBearerAuth()
export class SubcategoriesController {
  constructor(private readonly subcategoriesService: SubcategoriesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all subcategories (Public)' })
  @ApiResponse({
    status: 200,
    description: 'List of subcategories retrieved successfully',
  })
  async getAllSubcategories(
    @Query('search') search?: string,
    @Query('category_id') category_id?: string,
    @Query('status') status?: string
  ) {
    try {
      const subcategories = await this.subcategoriesService.getAllSubcategories(
        search,
        category_id,
        status
      );
      return {
        success: true,
        data: subcategories,
        message: 'Subcategories retrieved successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to retrieve subcategories',
          error: error.message || 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get subcategory by ID (Public)' })
  @ApiResponse({
    status: 200,
    description: 'Subcategory retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Subcategory not found',
  })
  async getSubcategoryById(@Param('id') id: string) {
    try {
      const subcategory = await this.subcategoriesService.getSubcategoryById(
        id
      );
      if (!subcategory) {
        throw new HttpException(
          {
            success: false,
            message: 'Subcategory not found',
          },
          HttpStatus.NOT_FOUND
        );
      }
      return {
        success: true,
        data: subcategory,
        message: 'Subcategory retrieved successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Failed to retrieve subcategory',
          error: error.message || 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post()
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Create a new subcategory (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Subcategory created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid data',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin privileges required',
  })
  async createSubcategory(
    @Body() createSubcategoryDto: CreateSubcategoryDto,
    @Req() request: RequestWithUser
  ) {
    try {
      const subcategory = await this.subcategoriesService.createSubcategory(
        createSubcategoryDto
      );
      return {
        success: true,
        data: subcategory,
        message: 'Subcategory created successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to create subcategory',
          error: error.message || 'Unknown error',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Put(':id')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Update a subcategory (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Subcategory updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Subcategory not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin privileges required',
  })
  async updateSubcategory(
    @Param('id') id: string,
    @Body() updateSubcategoryDto: UpdateSubcategoryDto,
    @Req() request: RequestWithUser
  ) {
    try {
      const subcategory = await this.subcategoriesService.updateSubcategory(
        id,
        updateSubcategoryDto
      );
      if (!subcategory) {
        throw new HttpException(
          {
            success: false,
            message: 'Subcategory not found',
          },
          HttpStatus.NOT_FOUND
        );
      }
      return {
        success: true,
        data: subcategory,
        message: 'Subcategory updated successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Failed to update subcategory',
          error: error.message || 'Unknown error',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Delete(':id')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Delete a subcategory (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Subcategory deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Subcategory not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin privileges required',
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - Subcategory cannot be deleted (has associated items)',
  })
  async deleteSubcategory(
    @Param('id') id: string,
    @Req() request: RequestWithUser
  ) {
    try {
      const result = await this.subcategoriesService.deleteSubcategory(id);
      if (!result) {
        throw new HttpException(
          {
            success: false,
            message: 'Subcategory not found',
          },
          HttpStatus.NOT_FOUND
        );
      }
      return {
        success: true,
        message: 'Subcategory deleted successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Failed to delete subcategory',
          error: error.message || 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
