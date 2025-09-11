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
import { BrandsService } from './brands.service';

interface RequestWithUser extends Request {
  user: any;
}

export interface CreateBrandDto {
  name: string;
  description: string;
}

export interface UpdateBrandDto {
  name?: string;
  description?: string;
}

@ApiTags('brands')
@Controller('brands')
@ApiBearerAuth()
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all brands (Public)' })
  @ApiResponse({
    status: 200,
    description: 'List of brands retrieved successfully',
  })
  async getAllBrands(@Query('search') search?: string) {
    try {
      const brands = await this.brandsService.getAllBrands(search);
      return {
        success: true,
        data: brands,
        message: 'Brands retrieved successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to retrieve brands',
          error: error.message || 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get brand by ID (Public)' })
  @ApiResponse({
    status: 200,
    description: 'Brand retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Brand not found',
  })
  async getBrandById(@Param('id') id: string) {
    try {
      const brand = await this.brandsService.getBrandById(id);
      if (!brand) {
        throw new HttpException(
          {
            success: false,
            message: 'Brand not found',
          },
          HttpStatus.NOT_FOUND
        );
      }
      return {
        success: true,
        data: brand,
        message: 'Brand retrieved successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Failed to retrieve brand',
          error: error.message || 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post()
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Create a new brand (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Brand created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid data',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin privileges required',
  })
  async createBrand(
    @Body() createBrandDto: CreateBrandDto,
    @Req() request: RequestWithUser
  ) {
    try {
      const brand = await this.brandsService.createBrand(createBrandDto);
      return {
        success: true,
        data: brand,
        message: 'Brand created successfully',
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to create brand',
          error: error.message || 'Unknown error',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Put(':id')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Update a brand (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Brand updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Brand not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin privileges required',
  })
  async updateBrand(
    @Param('id') id: string,
    @Body() updateBrandDto: UpdateBrandDto,
    @Req() request: RequestWithUser
  ) {
    try {
      const brand = await this.brandsService.updateBrand(id, updateBrandDto);
      if (!brand) {
        throw new HttpException(
          {
            success: false,
            message: 'Brand not found',
          },
          HttpStatus.NOT_FOUND
        );
      }
      return {
        success: true,
        data: brand,
        message: 'Brand updated successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Failed to update brand',
          error: error.message || 'Unknown error',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Delete(':id')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Delete a brand (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Brand deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Brand not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin privileges required',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Brand cannot be deleted (has associated items)',
  })
  async deleteBrand(@Param('id') id: string, @Req() request: RequestWithUser) {
    try {
      const result = await this.brandsService.deleteBrand(id);
      if (!result) {
        throw new HttpException(
          {
            success: false,
            message: 'Brand not found',
          },
          HttpStatus.NOT_FOUND
        );
      }
      return {
        success: true,
        message: 'Brand deleted successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Failed to delete brand',
          error: error.message || 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
